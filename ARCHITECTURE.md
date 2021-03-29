# Architecture
This file contains an overview of the structure of the project.

## Three.js globe

File  | Usage
------------- | -------------
`assets/js/src/globe/Globe.ts`  |  Creates an extendable Three.js sphere with a map texture of the landmasses.
`assets/js/src/DataCenterGlobe.ts`  |  Extends the Globe and adds data centers and renders the requests.
`assets/js/src/Geometry.ts`  |  Functions to calculate the curves for requests


## Phoenix

File  | Usage
------------- | -------------
`assets/js/app.js`  |  Create globe and listen for events
`lib/globe_request_mapper/node_manager.ex`  |  Listen for nodes joining and leaving, emit update events to client globes
`lib/globe_request_mapper/request.ex`  |  Retrieve/cache IP coordinates and helper functions for emitting request events
`lib/globe_request_mapper_web/live/globe_live.ex`  |  Liveview/socket for clients
