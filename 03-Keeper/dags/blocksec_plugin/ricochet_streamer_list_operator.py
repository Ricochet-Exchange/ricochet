from airflow.models.baseoperator import BaseOperator
from airflow.hooks.filesystem import FSHook
from airflow.utils.decorators import apply_defaults
from blocksec_plugin.web3_hook import Web3Hook
from blocksec_plugin.abis import RICOCHET_ABI
import requests, json
from time import sleep
import os


class RicochetStreamerListOperator(BaseOperator):
    """
    Checks for all UpdatedStream events on Ricochet and saves them into a file
    """
    template_fields = []

    @apply_defaults
    def __init__(self,
                 streamers_file_path,
                 fs_conn_id='fs_default',
                 web3_conn_id='web3_default',
                 contract_address=None,
                 *args,
                 **kwargs):
        super().__init__(*args, **kwargs)
        self.fs_conn_id = fs_conn_id
        self.web3_conn_id = web3_conn_id
        self.contract_address = contract_address
        self.web3 = Web3Hook(web3_conn_id=self.web3_conn_id).wss_client

        # Get the file to save state too
        hook = FSHook(self.fs_conn_id)
        basepath = hook.get_path()
        self.state_file_path = os.path.join(basepath, streamers_file_path)


    def execute(self, context):
        # Open and deserialize the state file
        print("Opening State file")
        current_block = self.web3.eth.block_number
        try:
            with open(self.state_file_path, 'r+') as state_file:
                state = json.loads(state_file.read())
        except FileNotFoundError:
            print("No statefile, setting last_block to the first block")
            state = {"last_block": 17476400}
        if state["last_block"] < current_block - 50000:
            current_block = state["last_block"] + 50000

        ricochet = self.web3.eth.contract(address=self.contract_address, abi=RICOCHET_ABI)
        event_filter = ricochet.events.UpdatedStream.createFilter(fromBlock=state["last_block"],toBlock=current_block)
        new_addresses = []
        print("Filtering Events")
        for event in event_filter.get_all_entries():
            print("Found Address", event.args["from"])
            addresses.append(event.args["from"])

        state["streamers"] = list(set(state["streamers"] + new_addresses))
        state["last_block"] = current_block

        # Save state to the state file
        print("Writting to statefile")
        with open(self.state_file, 'w') as state_file:
            state_file.write(json.dumps(state))

        # Return the list of streamers to xcom
        return state["streamers"]
