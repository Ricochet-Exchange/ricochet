# Ricochet Keeper
_Powered by Apache Airflow_

## Overview
This directory includes the Apache Airflow code required to run the Ricochet Keeper. The keeper executes transactions to:
1. Update the Tellor Oracle
2. Trigger distributions to all the streamers

## Build & Deploy
The project is built with Docker and can be run using `docker-compose up`
