import pytest
from unittest.mock import patch, MagicMock
import json
import os

from tripadvisor_mcp.server import make_api_request, config

@pytest.fixture
def mock_environ():
    with patch.dict(os.environ, {"TRIPADVISOR_API_KEY": "test_api_key"}):
        yield

@pytest.mark.asyncio
async def test_make_api_request(mock_environ):
    # Mock the httpx client response
    mock_response = MagicMock()
    mock_response.json.return_value = {"data": "test_data"}
    mock_response.raise_for_status = MagicMock()
    
    # Mock the httpx client
    mock_client = MagicMock()
    mock_client.__aenter__.return_value.get.return_value = mock_response
    
    with patch("httpx.AsyncClient", return_value=mock_client):
        result = await make_api_request("endpoint/test")
        
    assert result == {"data": "test_data"}
    mock_client.__aenter__.return_value.get.assert_called_once()
    url_called = mock_client.__aenter__.return_value.get.call_args[0][0]
    assert url_called == f"{config.base_url}/endpoint/test"
