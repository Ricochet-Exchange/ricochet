"""
Ricochet Stream Watch

- Checks all the streamers and closes streams that are close to running out

"""
from airflow import DAG
from airflow.models import Variable
<<<<<<< HEAD
from airflow.operators.bash_operator import BashOperator
from airflow.operators.python_operator import PythonOperator
from airflow.hooks.postgres_hook import PostgresHook
from airflow.api.client.local_client import Client
from blocksec_plugin.web3_hook import Web3Hook
from blocksec_plugin.ethereum_transaction_confirmation_sensor import EthereumTransactionConfirmationSensor
from blocksec_plugin.ricochet_streamer_list_operator import RicochetStreamerListOperator
from blocksec_plugin.abis import RICOCHET_ABI, ERC20_ABI
from datetime import datetime, timedelta
from web3 import Web3
from json import loads
import requests

DISTRIBUTOR_WALLET_ADDRESS = Variable.get("distributor-address", "0xe07c9696e00f23Fc7bAE76d037A115bfF33E28be")
=======
from datetime import datetime, timedelta
from blocksec_plugin.web3_hook import Web3Hook
from airflow.operators.bash_operator import BashOperator
from airflow.operators.python_operator import PythonOperator
from blocksec_plugin.ethereum_transaction_confirmation_sensor import EthereumTransactionConfirmationSensor
from blocksec_plugin.ricochet_streamer_list_operator import RicochetStreamerListOperator
from blocksec_plugin.abis import RICOCHET_ABI, ERC20_ABI
from json import loads
import requests

>>>>>>> main
EXCHANGE_ADDRESSES = Variable.get("ricochet-exchange-addresses", deserialize_json=True)

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


dag = DAG("ricochet_stream_watch",
          max_active_runs=1,
          catchup=False,
          default_args=default_args,
          schedule_interval="50 * * * *")


done = BashOperator(
    task_id='done',
    bash_command='date',
    dag=dag,
)


<<<<<<< HEAD
def review_streamers_and_trigger_closures(**context):
=======
def review_streamers_and_trigger_closures(exchange_address, **context):
>>>>>>> main
    """
    Trigger payouts for miners
    """
    execution_date = context['execution_date'].isoformat()
<<<<<<< HEAD
    exchange_address = context['exchange_address']
    print(f"Checking exchange {exchange_address}")
    sql = f"""
    with streamer_rates as (
        select args->>'from' as streamer,
        FIRST_VALUE(args->>'newRate') OVER (PARTITION BY args->>'from' ORDER BY block_number DESC) as rate
        from ethereum_events
        where event = 'UpdatedStream'
        and address ='{exchange_address}'
    )
    select distinct streamer, CAST(rate as float)
    from streamer_rates
    where CAST(rate as FLOAT) > 0
    order by 2 desc
    """
    print(sql)
    postgres = PostgresHook(postgres_conn_id='data_warehouse')
    conn = postgres.get_conn()
    cursor = conn.cursor()
    cursor.execute(sql)
    streamers = []
    for result in cursor.fetchall():
        streamers.append(result[0])

    print("Streamers", streamers)

    web3 = Web3Hook(web3_conn_id='infura').http_client
    c = Client(None, None)
    index = 0
    current_nonce = web3.eth.getTransactionCount(DISTRIBUTOR_WALLET_ADDRESS)
    for streamer in streamers:

        # Check if the streamers balance is less that 8 hours of streamer
        ricochet = web3.eth.contract(address=exchange_address, abi=RICOCHET_ABI)
        input_token = ricochet.functions.getInputToken().call()
        input_token = web3.eth.contract(address=input_token, abi=ERC20_ABI)
        balance = input_token.functions.balanceOf(streamer).call()
        rate = ricochet.functions.getStreamRate(streamer).call()
        is_closable = balance < rate * 60 * 60 * 8 # balance is greater than 8 hours of streaming
        print(f"Checked {streamer}, balance: {balance}, rate: {rate}, is_closable: {is_closable}")
=======
    # TODO: Payouts
    streamers = context['task_instance'].xcom_pull(task_ids='list_streamers_'+exchange_address)
    web3 = Web3Hook(web3_conn_id='infura').http_client
    c = Client(None, None)
    index = 0
    current_nonce = web3.eth.getTransactionCount(POOL_WALLET_ADDRESS)
    for index, streamer in enumerate(streamers):

        # Check if the streamers balance is less that 8 hours of streamer
        ricochet = web3.eth.contract(address=exchange_address, abi=RICOCHET_ABI)
        input_token = ricochet.functions.getInputToken()
        input_token = web3.eth.contract(address=input_token, abi=ERC20_ABI)
        balance = input_token.functions.balanceOf(streamer)
        rate = ricochet.functions.getStreamRate(streamer)
        is_closable = balance > rate * 60 * 60 * 8 # balance is greater than 8 hours of streaming

>>>>>>> main
        # Trigger ricochet_stream_closer is the stream is closable
        if is_closable:
            try:
                conf = {
                    "streamer_address": Web3.toChecksumAddress(streamer),
                    "exchange_address": exchange_address,
                    "nonce": current_nonce + index
                }
            except ValueError:
                print("Fail", miner_payout)
                continue

<<<<<<< HEAD
            index += 1
            result = c.trigger_dag(dag_id='ricochet_stream_closure',
                          run_id=streamer + execution_date,
                          conf=conf)
            print("Trigged closure: ", result, conf)
    return index # number of channels closed
=======
        index += 1
        result = c.trigger_dag(dag_id='ricochet_stream_closure',
                      run_id=streamer + execution_date,
                      conf=conf)
        print("Trigged: ", result, conf)
        sleep(2)
    return
>>>>>>> main


for exchange_address in EXCHANGE_ADDRESSES:

<<<<<<< HEAD
=======
    list_streamers = RicochetStreamerListOperator(
        streamers_file_path=exchange_address + "_streamers_state.json",
        web3_conn_id='infura',
        contract_address=exchange_address,
        task_id='list_streamers_'+exchange_address,
        dag=dag
    )

>>>>>>> main
    closures = PythonOperator(
        task_id='closures_' + exchange_address,
        provide_context=True,
        python_callable=review_streamers_and_trigger_closures,
<<<<<<< HEAD
        op_kwargs={'exchange_address': exchange_address},
=======
        op_args={'exchange_address': exchange_address},
>>>>>>> main
        dag=dag
    )


<<<<<<< HEAD
    done << closures
=======
    done << closures << list_streamers
>>>>>>> main
