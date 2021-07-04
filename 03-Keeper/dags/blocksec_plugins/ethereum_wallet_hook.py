from airflow.hooks.base_hook import BaseHook


class EthereumWalletHook(BaseHook):
    """
    Set the login as the public address, set the password and the private key
    """
    def __init__(self, ethereum_wallet):
        conn = self.get_connection(ethereum_wallet)
        self.public_address = conn.login
        self.private_key = conn.password
