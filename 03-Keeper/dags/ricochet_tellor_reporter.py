"""
Tellor Contract Poll

- Every 5 minutes, get the logs for Tellor
- Parse logs and insert them into the data warehouse

"""
from airflow import DAG
from airflow.models import Variable
from datetime import datetime, timedelta
from blocksec_plugin.web3_hook import Web3Hook
from airflow.operators.bash_operator import BashOperator
from airflow.operators.python_operator import PythonOperator
from blocksec_plugin.ethereum_transaction_confirmation_sensor import EthereumTransactionConfirmationSensor
from blocksec_plugin.tellor_oracle_operator import TellorOracleOperator
from blocksec_plugin.ricochet_distribute_operator import RicochetDistributeOperator
from blocksec_plugin.abis import TELLOR_ABI
from json import loads
import requests

REPORTER_WALLET_ADDRESS = Variable.get("reporter-address", "0xe07c9696e00f23Fc7bAE76d037A115bfF33E28be")
TELLOR_CONTRACT_ADDRESS = Variable.get("tellor-address", "0xACC2d27400029904919ea54fFc0b18Bf07C57875")
CURRENCIES = Variable.get("tellor-currencies", {"ethereum": 1, "wbtc": 60}, deserialize_json=True)

default_args = {
    "owner": "ricochet",
    "depends_on_past": False,
    "start_date": datetime(2020, 3, 29),
    "email": ["mike@mikeghen.com"],
    "email_on_failure": False,
    "email_on_retry": False,
    "retries": 0,
    "retry_delay": timedelta(minutes=1)
}


dag = DAG("ricochet_tellor_reporter",
          max_active_runs=1,
          catchup=False,
          default_args=default_args,
          schedule_interval="* * * * *")


# TODO: Consolidate these into 1 fxn
def check_price_ethereum(**context):
    """
    Check the price of the assets to use for updating the oracle
    """
    url = f"https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
    print(url)
    response = requests.get(url)
    result = response.json()
    print(result)
    # Raise the price by 50 basis points and scale for Tellor
    price = int(result["ethereum"]["usd"] * 1.005 * 1000000)
    return price

def check_price_wbtc(**context):
    """
    Check the price of the assets to use for updating the oracle
    """
    url = f"https://api.coingecko.com/api/v3/simple/price?ids=wbtc&vs_currencies=usd"
    print(url)
    response = requests.get(url)
    result = response.json()
    print(result)
    # Raise the price by 50 basis points and scale for Tellor
    price = int(result["wbtc"]["usd"] * 1.005 * 1000000)
    return price

done = BashOperator(
    task_id='done',
    bash_command='date',
    dag=dag,
)

web3 = Web3Hook(web3_conn_id='infura').http_client
current_nonce = web3.eth.getTransactionCount(REPORTER_WALLET_ADDRESS)
nonce_offset = 0

for currency, request_id in CURRENCIES.items():
    if currency == "ethereum":
        callable = check_price_ethereum
    elif currency == "wbtc":
        callable = check_price_wbtc

    price_check = PythonOperator(
        task_id="price_check_" + currency,
        provide_context=True,
        python_callable=callable,
        op_args={"currency": currency}, # not working?
        dag=dag
    )

    oracle_update = TellorOracleOperator(
        task_id="oracle_update_" + currency,
        web3_conn_id="infura",
        ethereum_wallet=REPORTER_WALLET_ADDRESS,
        contract_address=TELLOR_CONTRACT_ADDRESS,
        price='{{task_instance.xcom_pull(task_ids="price_check")}}',
        request_id=request_id,
        nonce=current_nonce + nonce_offset,
        gas_multiplier=2,
        gas=250000,
        dag=dag,
    )

    confirm_oracle_update = EthereumTransactionConfirmationSensor(
        task_id="confirm_oracle_update_" + currency,
        web3_conn_id="infura",
        transaction_hash="{{task_instance.xcom_pull(task_ids='oracle_update_old')}}",
        confirmations=1,
        poke_interval=5,
        dag=dag
    )

    done << confirm_oracle_update << oracle_update << price_check
    nonce_offset += 1
