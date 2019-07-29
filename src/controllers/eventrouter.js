/*
 * Copyright 2019-present Open Networking Foundation

 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at

 * http://www.apache.org/licenses/LICENSE-2.0

 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


(function () {
    'use strict';

    const _ = require('lodash');
    const logger = require('../config/logger.js');
    const Client = require('../types/client.js');
    const WorkflowRun = require('../types/workflowrun.js');
    const ws_probe = require('./ws_probe.js');
    const ws_manager = require('./ws_manager.js');
    const ws_workflowrun = require('./ws_workflowrun.js');

    let allClients = {}; // has publishers and subscribers
    let probeClients = {}; // a subset of clients
    let workflowManagerClients = {}; // a subset of clients
    let workflowRunClients = {}; // a subset of clients

    //let io;

    // key: workflow id
    // value: Workflow instance
    let workflows = {};

    // key: workflow run id
    // value: WorkflowRun instance
    let workflowRuns = {};

    let serviceEvents = {
        GREETING: 'cord.workflow.ctlsvc.greeting'
    };

    setInterval(function () {
        let requests = [];
        _.forOwn(workflowRuns, (workflowRun, workflowRunId) => {
            let obj = {
                workflow_id: workflowRun.getWorkflowId(),
                workflow_run_id: workflowRunId
            };
            requests.push(obj);
        });

        checkWorkflowRunStatusBulk(requests);
    }, 5000);

    // add ws_probe events
    _.forOwn(ws_probe.serviceEvents, (wsServiceEvent, key) => {
        serviceEvents[key] = wsServiceEvent;
    });

    // add ws_manager events
    _.forOwn(ws_manager.serviceEvents, (wsServiceEvent, key) => {
        serviceEvents[key] = wsServiceEvent;
    });

    // add ws_workflowrun events
    _.forOwn(ws_workflowrun.serviceEvents, (wsServiceEvent, key) => {
        serviceEvents[key] = wsServiceEvent;
    });

    //const setIO = (ioInstance) => {
    //    io = ioInstance;
    //};

    const checkObject = (obj) => {
        return Object.prototype.toString.call(obj) === '[object Object]';
    };

    const destroy = () => {
        removeClients();
        clearWorkflowRuns();
        clearWorkflows();
    };

    const listWorkflows = () => {
        let workflowList = [];
        _.forOwn(workflows, (_workflow, workflowId) => {
            workflowList.push(workflowId);
        });
        return workflowList;
    };

    const checkWorkflow = (workflowId) => {
        if(workflowId in workflows) {
            return true;
        }
        return false;
    };

    const addWorkflow = (workflow) => {
        if(workflow.getId() in workflows) {
            logger.log('error', `there exists a workflow with the same id - ${workflow.getId()}`);
            return false;
        }

        let workflowId = workflow.getId();
        workflows[workflowId] = workflow;
        return true;
    };

    const getWorkflow = (workflowId) => {
        if(workflowId in workflows) {
            logger.log('warn', `cannot find a workflow with id - ${workflowId}`);
            return null;
        }

        return workflows[workflowId];
    };

    const clearWorkflows = () => {
        _.forOwn(workflows, (_workflow, workflowId) => {
            delete workflows[workflowId];
        });
    };

    const listWorkflowRuns = () => {
        let workflowRunList = [];
        _.forOwn(workflowRuns, (_workflowRun, workflowRunId) => {
            workflowRunList.push(workflowRunId);
        });
        return workflowRunList;
    };

    const checkWorkflowRun = (workflowRunId) => {
        if(workflowRunId in workflowRuns) {
            return true;
        }
        return false;
    };

    const addWorkflowRun = (workflowRun) => {
        let workflowId = workflowRun.getWorkflowId();
        let workflowRunId = workflowRun.getId();

        if(workflowRunId in workflowRuns) {
            logger.log('warn', `there exists a workflow run with the same id - ${workflowRunId}`);
            return false;
        }

        if(!(workflowId in workflows)) {
            logger.log('warn', `cannot find a workflow with id - ${workflowId}`);
            return false;
        }

        workflowRuns[workflowRunId] = workflowRun;
        return true;
    };

    const getWorkflowRun = (workflowRunId) => {
        if(workflowRunId in workflowRuns) {
            logger.log('warn', `cannot find a workflow run with id - ${workflowRunId}`);
            return null;
        }

        return workflowRuns[workflowRunId];
    };

    const clearWorkflowRuns = () => {
        _.forOwn(workflowRuns, (_workflowRun, workflowRunId) => {
            delete workflowRuns[workflowRunId];
        });
    };

    const updateWorkflowRunStatus = (workflowRunId, taskId, status) => {
        if(!(workflowRunId in workflowRuns)) {
            logger.log('warn', `cannot find a workflow run with the id - ${workflowRunId}`);
            return false;
        }

        let workflowRun = workflowRuns[workflowRunId];
        workflowRun.updateTaskStatus(taskId, status);
        return true;
    };

    const setWorkflowRunKickstarted = (workflowRunId) => {
        if(!(workflowRunId in workflowRuns)) {
            logger.log('warn', `cannot find a workflow run with the id - ${workflowRunId}`);
            return false;
        }

        let workflowRun = workflowRuns[workflowRunId];
        workflowRun.setKickstarted();
        return true;
    };

    const setWorkflowRunStatus = (workflowRunId, status) => {
        if(!(workflowRunId in workflowRuns)) {
            logger.log('warn', `cannot find a workflow run with the id - ${workflowRunId}`);
            return false;
        }

        if(status in ['success', 'failed', 'end']) {
            removeWorkflowRun(workflowRunId);
        }
        return true;
    };

    const kickstart = (workflowId, workflowRunId) => {
        if(!(workflowId in workflows)) {
            logger.log('warn', `cannot find a workflow with the id - ${workflowId}`);
            return false;
        }

        if(!(workflowRunId in workflowRuns)) {
            logger.log('warn', `cannot find a workflow run with the id - ${workflowRunId}`);
            return false;
        }

        ws_manager.kickstartWorkflow(workflowId, workflowRunId);
        return true;
    };

    /*
    const checkWorkflowRunStatus = (workflowId, workflowRunId) => {
        if(!(workflowId in workflows)) {
            logger.log('warn', `cannot find a workflow with the id - ${workflowId}`);
            return false;
        }

        if(!(workflowRunId in workflowRuns)) {
            logger.log('warn', `cannot find a workflow run with the id - ${workflowRunId}`);
            return false;
        }

        ws_manager.checkWorkflowRunStatus(workflowId, workflowRunId);
        return true;
    };
    */

    const checkWorkflowRunStatusBulk = (requests) => {
        if(requests) {
            ws_manager.checkWorkflowRunStatusBulk(requests);
            return true;
        }
        return false;
    };

    const removeWorkflow = (workflowId) => {
        if(!(workflowId in workflows)) {
            logger.log('warn', `cannot find a workflow with the id - ${workflowId}`);
            return false;
        }

        // check if there are workflow runs
        for(let key in workflowRuns) {
            if (!workflowRuns.hasOwnProperty(key)) {
                continue;
            }

            let workflowRun = workflowRuns[key];
            if(workflowRun.getWorkflowId() === workflowId) {
                logger.log('warn', `there exists a workflow run for a workflow id - ${workflowId}`);
                return false;
            }
        }

        // we don't use below code becuase it cannot properly stop and return value with 'return'
        // _.forOwn(workflowRuns, (workflowRun, _workflowRunId) => {
        //     if(workflowRun.getWorkflowId() === workflowId) {
        //         logger.log('warn', `there exists a workflow run for a workflow id - ${workflowId}`);
        //         return false;
        //     }
        // });

        delete workflows[workflowId];
        return true;
    };

    const removeWorkflowRun = (workflowRunId) => {
        if(!(workflowRunId in workflowRuns)) {
            logger.log('warn', `cannot find a workflow run with the id - ${workflowRunId}`);
            return false;
        }

        let workflowRun = workflowRuns[workflowRunId];
        delete workflowRuns[workflowRunId];

        workflowRun.setFinished();
        return true;
    };

    const emitEvent = (topic, message) => {
        // list of workflowIds
        // to check if there are workflow runs for the events
        let workflowIdsRunning = [];

        logger.log('debug', `event is raised : topic ${topic}, message ${JSON.stringify(message)}`);

        // route event to running instances
        _.forOwn(workflowRuns, (workflowRun, workflowRunId) => {
            let workflowId = workflowRun.getWorkflowId();
            let workflow = workflows[workflowId];

            // event will be routed to workflow runs that meet following criteria
            // 1) the workflow is currently interested in the same topic
            //      (already finished tasks are not counted)
            // 2) the task's key field and value
            if(workflowRun.isEventAcceptable(workflow, topic, message)) {
                //console.log(`event ${topic} is routed to workflow run ${workflowRunId}`);
                logger.log('debug', `event ${topic} is routed to workflow run ${workflowRunId}`);
                workflowRun.enqueueEvent(topic, message);

                if(!workflowIdsRunning.includes(workflowId)) {
                    workflowIdsRunning.push(workflowId);
                }
            }
        });

        // check if the event is a kickstart event
        _.forOwn(workflows, (workflow, workflowId) => {
            if(workflow.isKickstartTopic(topic)) {
                // check if there is a workflow run for the event
                // kickstart a workflow if there is no workflows runs for the event
                if(!workflowIdsRunning.includes(workflowId)) {
                    // we need to buffer the event until workflow run is brought up
                    let workflowRun = WorkflowRun.WorkflowRun.makeNewRun(workflow);
                    workflowRun.updateEventKeyFieldValueFromMessage(topic, message);

                    let workflowRunId = workflowRun.getId();

                    // register for management
                    workflowRuns[workflowRunId] = workflowRun;

                    // route event
                    logger.log('debug', `event ${topic} is routed to a new workflow run ${workflowRunId}`);
                    workflowRun.enqueueEvent(topic, message);

                    // KICKSTART!
                    kickstart(workflowId, workflowRunId);
                }
            }
        });

        return true;
    };

    const countQueuedEvents = (workflowRunId) => {
        // this counts queued events
        if(!(workflowRunId in workflowRuns)) {
            logger.log('warn', `workflow run ${workflowRunId} does not exist`);
            return null;
        }

        let workflowRun = workflowRuns[workflowRunId];
        return workflowRun.lengthEventQueue();
    };

    const fetchEvent = (workflowRunId, taskId, topic) => {
        // this returns an event or an empty obj when there is no message
        if(!(workflowRunId in workflowRuns)) {
            logger.log('warn', `workflow run ${workflowRunId} does not exist`);
            return null;
        }

        let workflowRun = workflowRuns[workflowRunId];
        let workflowId = workflowRun.getWorkflowId();

        if(!(workflowId in workflows)) {
            logger.log('warn', `workflow ${workflowId} does not exist`);
            return null;
        }

        let workflow = workflows[workflowId];

        let task = workflow.getTask(taskId);
        if(!task) {
            logger.log('warn', `workflow ${workflowId} does not have task ${taskId}`);
            return null;
        }

        logger.log('debug', `workflow run ${workflowRunId}, task ${taskId} fetches an event`);

        let event = workflowRun.dequeueEvent(topic);
        if(event) {
            return event;
        }
        else {
            return {};
        }
    };

    const addClient = (c) => {
        let clientId = c.getId();
        let socket = c.getSocket();

        // check id that client is already there
        if(clientId in allClients) {
            logger.log('warn', `there exists a client with the same id - ${clientId}`);
            return false;
        }

        if(c.getType() === Client.Type.PROBE) {
            // probe
            // probe protocol:
            // REQ:
            //      topic: operation
            //      message: {
            //          req_id: <req_id>,
            //          topic: <topic>,
            //          message: <data>
            //      }
            // RES:
            //      topic: topic sent
            //      message: {
            //          req_id: <req_id>,
            //          error: <true/false>,
            //          result: <true/false>,
            //          message: <error message>
            //      }
            allClients[clientId] = c;
            probeClients[clientId] = c;

            // attach probe operations
            let router = ws_probe.getRouter();
            _.forOwn(router, (routerElem, _key) => {
                socket.on(routerElem.topic, (msg) => {
                    logger.log('debug', `received a probe event ${routerElem.topic} - ${JSON.stringify(msg)}`);

                    // handle a common parameter - req_id
                    // when we get req_id, return the same req_id in response.
                    // this is to help identify a request from a response at client-side
                    let req_id = 101010; // default number, signiture
                    if(msg && checkObject(msg)) {
                        if('req_id' in msg) {
                            req_id = msg.req_id;
                        }
                    }

                    routerElem.handler(routerElem.topic, msg || {}, (err, result) => {
                        if(err) {
                            logger.log('warn', `unable to handle a message - ${err}`);
                            socket.emit(routerElem.topic, {
                                req_id: req_id,
                                error: true,
                                result: result,
                                message: err
                            });
                            return;
                        }

                        // we return result
                        if(routerElem.return === undefined || routerElem.return) {
                            socket.emit(routerElem.topic, {
                                req_id: req_id,
                                error: false,
                                result: result
                            });
                        }
                    });
                });
            });
            return true;
        }
        else if(c.getType() === Client.Type.WORKFLOW_MANAGER) {
            // manager
            // manager protocol:
            // REQ:
            //      topic: operation
            //      message: {
            //          req_id: <req_id>,
            //          <data>...
            //      }
            // RES:
            //      topic: topic sent
            //      message: {
            //          req_id: <req_id>,
            //          error: <true/false>,
            //          result: <true/false>,
            //          message: <error message>
            //      }
            allClients[clientId] = c;
            workflowManagerClients[clientId] = c;

            // attach manager operations
            let router = ws_manager.getRouter();
            _.forOwn(router, (routerElem, _key) => {
                socket.on(routerElem.topic, (msg) => {
                    logger.log('debug', `received a manager event ${routerElem.topic} - ${JSON.stringify(msg)}`);

                    // handle a common parameter - req_id
                    // when we get req_id, return the same req_id in response.
                    // this is to help identify a request from a response at client-side
                    let req_id = 101010; // default number, signiture
                    if(msg && checkObject(msg)) {
                        if('req_id' in msg) {
                            req_id = msg.req_id;
                        }
                    }

                    routerElem.handler(routerElem.topic, msg || {}, (err, result) => {
                        if(err) {
                            logger.log('warn', `unable to handle a message - ${err}`);
                            socket.emit(routerElem.topic, {
                                req_id: req_id,
                                error: true,
                                result: result,
                                message: err
                            });
                            return;
                        }

                        // we return result
                        if(routerElem.return === undefined || routerElem.return) {
                            socket.emit(routerElem.topic, {
                                req_id: req_id,
                                error: false,
                                result: result
                            });
                        }
                    });
                });
            });
            return true;
        }
        else if(c.getType() === Client.Type.WORKFLOW_RUN) {
            // workflow run
            // workflow run protocol:
            // REQ:
            //      topic: operation
            //      message: {
            //          req_id: <req_id>,
            //          <data>...
            //      }
            // RES:
            //      topic: topic sent
            //      message: {
            //          req_id: <req_id>,
            //          error: <true/false>,
            //          result: <true/false>,
            //          message: <error message>
            //      }

            // map to WorkflowRun instance
            let workflowId = c.getWorkflowId();
            let workflowRunId = c.getWorkflowRunId();
            let workflowRun;

            if(!(workflowId in workflows)) {
                logger.log('warn', `cannot find a workflow ${workflowId}`);
                return false;
            }

            // register client to workflow run
            if(!(workflowRunId in workflowRuns)) {
                // workflow run not exist yet
                logger.log('warn', `cannot find a workflow run ${workflowRunId}`);
                return false;
            }

            //let workflow = workflows[workflowId];

            allClients[clientId] = c;
            workflowRunClients[clientId] = c;

            // update
            workflowRun = workflowRuns[workflowRunId];
            workflowRun.addClientId(clientId);

            // attach workflow run operations
            let router = ws_workflowrun.getRouter();
            _.forOwn(router, (routerElem, _key) => {
                socket.on(routerElem.topic, (msg) => {
                    logger.log('debug', `received a workflow run event ${routerElem.topic} - ${JSON.stringify(msg)}`);

                    // handle a common parameter - req_id
                    // when we get req_id, return the same req_id in response.
                    // this is to help identify a request from a response at client-side
                    let req_id = 101010; // default number, signiture
                    if(msg && checkObject(msg)) {
                        if('req_id' in msg) {
                            req_id = msg.req_id;
                        }
                    }

                    routerElem.handler(routerElem.topic, msg || {}, (err, result) => {
                        if(err) {
                            logger.log('warn', `unable to handle a message - ${err}`);
                            socket.emit(routerElem.topic, {
                                req_id: req_id,
                                error: true,
                                result: false,
                                message: err
                            });
                            return;
                        }

                        // we return result
                        if(routerElem.return === undefined || routerElem.return) {
                            socket.emit(routerElem.topic, {
                                req_id: req_id,
                                error: false,
                                result: result
                            });
                        }
                    });
                });
            });
            return true;
        }
        return false;
    };

    const removeClient = (id) => {
        if(id in allClients) {
            let removedClient = allClients[id];
            delete allClients[id];

            let type = removedClient.getType();
            if(type === Client.Type.PROBE) {
                delete probeClients[id];
            }
            else if(type === Client.Type.WORKFLOW_MANAGER) {
                delete workflowManagerClients[id];
            }
            else if(type === Client.Type.WORKFLOW_RUN) {
                delete workflowRunClients[id];

                let workflowRunId = removedClient.getWorkflowRunId();
                let workflowRun = workflowRuns[workflowRunId];

                if(workflowRun) {
                    workflowRun.removeClientId(id);

                    //TODO
                    // WorkflowRun can have no clients between tasks
                    // So we should not remove the run until the workflow run finishes
                }
            }
        }
    };

    const removeClients = () => {
        let probeClients = {};

        _.forOwn(probeClients, (_probeClient, clientId) => {
            delete probeClients[clientId];
        });

        _.forOwn(workflowManagerClients, (_workflowManagerClient, clientId) => {
            delete workflowManagerClients[clientId];
        });

        _.forOwn(workflowRunClients, (_workflowRunClients, clientId) => {
            delete workflowRunClients[clientId];
        });

        _.forOwn(allClients, (client, clientId) => {
            client.getSocket().disconnect(true);
            delete allClients[clientId];
        });
    }

    module.exports = {
        serviceEvents: serviceEvents,
        destroy: destroy,
        getClients: () => { return allClients; },
        getProbeClients: () => { return probeClients; },
        getWorkflowManagerClients: () => { return workflowManagerClients; },
        getWorkflowRunClients: () => { return workflowRunClients; },
        clientType: Client.Type,
        //setIO: setIO,
        emitEvent: emitEvent,
        countQueuedEvents: countQueuedEvents,
        fetchEvent: fetchEvent,
        addClient: addClient,
        removeClient: removeClient,
        removeClients: removeClients,
        addWorkflow: addWorkflow,
        getWorkflow: getWorkflow,
        listWorkflows: listWorkflows,
        checkWorkflow: checkWorkflow,
        removeWorkflow: removeWorkflow,
        clearWorkflows: clearWorkflows,
        addWorkflowRun: addWorkflowRun,
        getWorkflowRun: getWorkflowRun,
        listWorkflowRuns: listWorkflowRuns,
        checkWorkflowRun: checkWorkflowRun,
        removeWorkflowRun: removeWorkflowRun,
        clearWorkflowRuns: clearWorkflowRuns,
        updateWorkflowRunStatus: updateWorkflowRunStatus,
        setWorkflowRunKickstarted: setWorkflowRunKickstarted,
        setWorkflowRunStatus: setWorkflowRunStatus
    };
})();
