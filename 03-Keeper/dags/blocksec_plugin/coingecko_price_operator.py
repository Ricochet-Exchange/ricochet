from airflow.models.baseoperator import BaseOperator
from airflow.utils.decorators import apply_defaults
import requests, json


class CoinGeckoPriceOperator(BaseOperator):
    """
    Gets a price from Coingecko using its asset_id
    """
    template_fields = []

    @apply_defaults
    def __init__(self,
                 asset_id=None,
                 *args,
                 **kwargs):
        super().__init__(*args, **kwargs)
        self.asset_id = asset_id


    def execute(self, context):
        """
        Check the price of the assets to use for updating the oracle
        """
        url = "https://api.coingecko.com/api/v3/simple/price?ids={0}&vs_currencies=usd".format(self.asset_id)
        print(url)
        response = requests.get(url)
        result = response.json()
        print(result)
        # Raise the price by 1e6 and scale for Tellor
        price = int(result[self.asset_id]["usd"] * 1000000)
        return str(price)
