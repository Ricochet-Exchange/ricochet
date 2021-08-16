from airflow.hooks.base_hook import BaseHook
from web3 import Web3, HTTPProvider


class Web3Hook(BaseHook):
    """
    Requires the following extra properties:
    {
     "http_endpoint_uri": "https://mainnet.infura.io/v3/xxxx",
     "wss_endpoint_uri": "wss://mainnet.infura.io/v3/xxxx"
    }
    """
    def __init__(self, web3_conn_id):
        self.web3_conn_id = web3_conn_id
        extras = self.get_connection(self.web3_conn_id).extra_dejson
        self.http_endpoint_uri = extras["http_endpoint_uri"]
        self.wss_endpoint_uri = extras["wss_endpoint_uri"]
        self.wss_client = Web3(Web3.WebsocketProvider(self.wss_endpoint_uri))
        self.http_client = Web3(Web3.HTTPProvider(self.http_endpoint_uri,request_kwargs={'timeout': 60}))
