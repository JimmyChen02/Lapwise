from dataclasses import replace
from datetime import date
from urllib.parse import quote

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.data import Catalog
from app.schemas import RecommendationRequest
from app.scoring import recommend

client = TestClient(app)
BASE = {
    'major': 'Computer Science', 'budget_usd': 1300,
    'operating_system': 'Windows', 'usage': ['programming', 'schoolwork'],
    'screen_size_preference': '13-14', 'portability': 'high',
    'storage_preference_gb': 512, 'allow_chromebooks': False,
}


def test_catalog_excludes_tablets_and_preserves_estimated_specs():
    response = client.get('/api/v1/laptops')
    assert response.status_code == 200
    laptops = response.json()['laptops']
    assert len(laptops) == 7
    assert all(l['device_type'] != 'tablet' for l in laptops)
    dell = next(l for l in laptops if l['laptop_id'] == 'Dell XPS 13')
    assert dell['specifications']['ram_estimated'] is True
    assert dell['tradeoffs']
    assert client.get('/health').json()['laptops_loaded'] == 7


def test_recommendation_contract_and_hard_filters():
    response = client.post('/api/v1/recommendations', json=BASE)
    assert response.status_code == 200
    data = response.json()
    assert data['status'] == 'success'
    assert data['recommendation_count'] == 3
    recs = data['recommendations']
    assert [r['rank'] for r in recs] == [1, 2, 3]
    assert all(r['latest_recorded_price_usd'] <= BASE['budget_usd'] for r in recs)
    assert all(r['specifications']['os'].startswith('Windows') for r in recs)
    assert [r['match_score'] for r in recs] == sorted([r['match_score'] for r in recs], reverse=True)
    assert all(r['reasons'] and 0 <= r['match_score'] <= 100 for r in recs)


def test_no_matches_does_not_relax_budget():
    data = client.post('/api/v1/recommendations', json={**BASE, 'budget_usd': 1}).json()
    assert data['status'] == 'no_matches'
    assert data['recommendations'] == []
    assert data['recommendation_count'] == 0


@pytest.mark.parametrize('field,value', [('budget_usd', 0), ('major', '  '), ('usage', []), ('operating_system', 'Linux'), ('storage_preference_gb', -1)])
def test_survey_validation_contract(field, value):
    response = client.post('/api/v1/recommendations', json={**BASE, field: value})
    assert response.status_code == 422
    data = response.json()
    assert data['error_code'] == 'INVALID_SURVEY_INPUT'
    assert any(error['field'] == field for error in data['validation_errors'])


def test_invalid_json_has_useful_error():
    response = client.post('/api/v1/recommendations', content='{', headers={'Content-Type': 'application/json'})
    assert response.status_code == 422
    assert response.json()['validation_errors'][0]['field'] == 'body'


def test_chromebook_opt_in_and_conflicting_preferences():
    survey = {**BASE, 'operating_system': 'ChromeOS', 'budget_usd': 3000}
    rejected = client.post('/api/v1/recommendations', json=survey).json()
    assert rejected['status'] == 'no_matches'
    assert rejected['warnings']
    accepted = client.post('/api/v1/recommendations', json={**survey, 'allow_chromebooks': True}).json()
    assert accepted['recommendation_count'] == 1
    assert accepted['recommendations'][0]['specifications']['os'] == 'ChromeOS'


def test_real_history_is_sorted_and_matches_summary():
    for laptop in client.get('/api/v1/laptops').json()['laptops']:
        response = client.get(f"/api/v1/laptops/{quote(laptop['laptop_id'])}/prices")
        assert response.status_code == 200
        points = response.json()['observations']
        assert [p['date'] for p in points] == sorted(p['date'] for p in points)
        assert points[-1]['price_usd'] == laptop['latest_recorded_price_usd']
        assert min(p['price_usd'] for p in points) == laptop['price_history']['historical_low_usd']
        assert max(p['price_usd'] for p in points) == laptop['price_history']['historical_high_usd']
    assert client.get('/api/v1/laptops/does-not-exist/prices').status_code == 404
    assert client.get('/api/v1/laptops/Apple%20iPad%2011-inch%20A16%20(Pink)/prices').status_code == 404


def test_missing_prices_report_partial_without_fake_values():
    catalog = Catalog()
    laptop = next(l for l in catalog.laptops if l.os_family == 'Windows')
    catalog.laptops = [replace(laptop, prices=None)]
    data = recommend(catalog, RecommendationRequest(**BASE), today=date(2026, 11, 22))
    assert data.status == 'partial'
    assert data.recommendations[0].latest_recorded_price_usd is None
    assert data.recommendations[0].price_history is None
    assert any('could not be verified' in w for w in data.warnings)


def test_stale_prices_are_disclosed():
    data = recommend(Catalog(), RecommendationRequest(**BASE), today=date(2030, 1, 1))
    assert any('days old' in w for w in data.warnings)


def test_options_and_frontend():
    options = client.get('/api/v1/options').json()
    assert BASE['operating_system'] in options['operating_system']
    assert set(BASE['usage']).issubset(options['usage'])
    response = client.get('/')
    assert response.status_code == 200
    assert 'Lapwise' in response.text
    assert client.get('/docs').status_code == 200
