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

    const path = require('path');
    const chai = require('chai');
    const expect = chai.expect;
    const sinonChai = require('sinon-chai');
    chai.use(sinonChai);
    const io = require('socket.io-client');
    const async = require('async');
    const _ = require('lodash');
    const server = require('../src/server.js');
    const port = 4000;
    const eventrouter = require('../src/controllers/eventrouter.js');
    const essenceLoader = require('../src/workflows/loader.js');
    const essenceFileName = path.join(__dirname, 'test_multi_workflow_essence.json');

    var probeClient;
    var workflowManagerClients = [];
    var workflowRunClients = [];
    var workflowIds = [];
    var workflowRunInfos = [];

    var receivedKickstartMessages = [[],[]];

    describe('Workflow kickstart test', function() {
        this.slow(5000);

        before(function() {
            // Start our server
            server.start(port);
        });

        after(function() {
            server.stop();
        });

        beforeEach(function(done) {
            async.series([
                (callback) => {
                    // connect a probe to the server
                    // to send events for test
                    probeClient = io.connect(`http://localhost:${port}`, {
                        query: 'id=probe_id&type=probe' +
                                '&name=probe@xos.org'
                    });

                    probeClient.on('connect', () => {
                        callback(null, true);
                    });
                    return;
                },
                (callback) => {
                    // connect first workflow manager to the server
                    // this manager will kickstart a workflow
                    let workflowManagerClient = io.connect(`http://localhost:${port}`, {
                        query: 'id=workflow_manager_id1&type=workflow_manager' +
                                '&name=manager1@xos.org'
                    });

                    workflowManagerClient.on(eventrouter.serviceEvents.WORKFLOW_KICKSTART, (message) => {
                        // save it for check
                        receivedKickstartMessages[0].push(message);

                        // save workflow_id and workflow_run_id
                        workflowRunInfos.push({
                            workflowId: message.workflow_id,
                            workflowRunId: message.workflow_run_id
                        });

                        setTimeout(() => {
                            // call-back
                            workflowManagerClient.emit(eventrouter.serviceEvents.WORKFLOW_NOTIFY_NEW_RUN, {
                                workflow_id: message.workflow_id,
                                workflow_run_id: message.workflow_run_id
                            })
                        }, 1000);
                    });

                    workflowManagerClient.on('connect', () => {
                        callback(null, true);
                    });

                    workflowManagerClients.push(workflowManagerClient);
                    return;
                },
                (callback) => {
                    // connect second workflow manager to the server
                    // this manager will not kickstart a workflow
                    let workflowManagerClient = io.connect(`http://localhost:${port}`, {
                        query: 'id=workflow_manager_id2&type=workflow_manager' +
                                '&name=manager2@xos.org'
                    });

                    workflowManagerClient.on(eventrouter.serviceEvents.WORKFLOW_KICKSTART, (message) => {
                        receivedKickstartMessages[1].push(message);

                        setTimeout(() => {
                            // call-back
                            workflowManagerClient.emit(eventrouter.serviceEvents.WORKFLOW_NOTIFY_NEW_RUN, {
                                workflow_id: message.workflow_id,
                                workflow_run_id: message.workflow_run_id
                            })
                        }, 1000);
                    });

                    workflowManagerClient.on('connect', () => {
                        callback(null, true);
                    });

                    workflowManagerClients.push(workflowManagerClient);
                    return;
                },
                (callback) => {
                    let essence = essenceLoader.loadEssence(essenceFileName, true);

                    // register the workflow
                    workflowManagerClients[0].emit(eventrouter.serviceEvents.WORKFLOW_REGISTER_ESSENCE, {
                        essence: essence
                    });

                    _.forOwn(essence, (_value, workflowId) => {
                        // save
                        workflowIds.push(workflowId);
                    });

                    // handle return
                    workflowManagerClients[0].on(
                        eventrouter.serviceEvents.WORKFLOW_REGISTER_ESSENCE,
                        (workflowRegResult) => {
                            callback(null, workflowRegResult);
                        }
                    );
                    return;
                }
            ],
            function(err, results) {
                // we do not actually check results;
                if(results.includes(false)) {
                    done.fail(err);
                }
                else {
                    done();
                }
            });
            return;
        });

        afterEach(function() {
            // remove workflow runs
            _.forOwn(workflowRunInfos, (workflowRunInfo) => {
                workflowManagerClients[0].emit(server.serviceEvents.WORKFLOW_REMOVE_RUN, {
                    workflow_id: workflowRunInfo.workflowId,
                    workflow_run_id: workflowRunInfo.workflowRunId
                });
            });
            workflowRunInfos.length = 0;

            // remove workflows
            _.forOwn(workflowIds, (workflowId) => {
                workflowManagerClients[0].emit(server.serviceEvents.WORKFLOW_REMOVE, {
                    workflow_id: workflowId
                });
            });
            workflowIds.length = 0;

            // remove message store
            receivedKickstartMessages.forEach((receivedKickstartMessageStore) => {
                receivedKickstartMessageStore.length = 0;
            });

            // disconnect clients
            workflowManagerClients.forEach((workflowManagerClient) => {
                if(workflowManagerClient.connected) {
                    workflowManagerClient.disconnect();
                }
            });
            workflowManagerClients.length = 0;

            workflowRunClients.forEach((workflowRunClient) => {
                if(workflowRunClient.connected) {
                    workflowRunClient.disconnect();
                }
            });
            workflowRunClients.length = 0;

            if(probeClient.connected) {
                probeClient.disconnect();
            }
            probeClient = null;
        });

        it('should have two workflows', function(done) {
            workflowManagerClients[0].on(eventrouter.serviceEvents.WORKFLOW_LIST, (result) => {
                let workflowsList = result.result;
                expect(workflowsList.length).to.equal(2);
                workflowsList.forEach((workflowIdInList) => {
                    expect(workflowIds).to.includes(workflowIdInList);
                });
                done();
            });

            workflowManagerClients[0].emit(eventrouter.serviceEvents.WORKFLOW_LIST, {});
        });

        it('all managers should receive kickstart messages', function(done) {
            this.timeout(5000);

            // kickstart the workflow
            probeClient.emit('onu.events', {serialNumber: 'testSerialXXX', other: 'test_other_field'});
            setTimeout(() => {
                expect(receivedKickstartMessages.length, 'num of message stores').to.equal(2);
                receivedKickstartMessages.forEach((receivedKickstartMessageStore) => {
                    expect(receivedKickstartMessageStore.length, 'num of messages in a store').to.equal(1);
                });
                done();
            }, 2000);
        });

        it('should have only one workflow run', function(done) {
            this.timeout(5000);

            // kickstart the workflow
            probeClient.emit('onu.events', {serialNumber: 'testSerialXXX', other: 'test_other_field'});
            setTimeout(() => {
                // kickstart will take 2 seconds roughly
                expect(workflowRunInfos.length, 'num of workflow runs').to.equal(1);
                // the workflow must be 'should_be_called'
                expect(workflowRunInfos[0].workflowId, 'workflow id').to.equal('should_be_called');
                done();
            }, 2000);
        });

        it('should read an event that is used for workflow kickstart', function(done) {
            this.timeout(5000);

            // kickstart the workflow
            probeClient.emit('onu.events', {serialNumber: 'testSerialXXX', other: 'test_other_field'});
            setTimeout(() => {
                // kickstart will take 2 seconds roughly
                expect(workflowRunInfos.length, 'num of workflow runs').to.equal(1);
                // the workflow must be 'should_be_called'
                expect(workflowRunInfos[0].workflowId, 'workflow id').to.equal('should_be_called');

                // connect a workflow run client to the server
                let workflowRunClient = io.connect(`http://localhost:${port}`, {
                    query: 'id=workflow_run_id1&type=workflow_run' +
                            `&workflow_id=${workflowRunInfos[0].workflowId}` +
                            `&workflow_run_id=${workflowRunInfos[0].workflowRunId}` +
                            '&name=run1@xos.org'
                });
                workflowRunClients.push(workflowRunClient);

                workflowRunClient.on('connect', () => {
                    workflowRunClient.emit(eventrouter.serviceEvents.WORKFLOW_RUN_FETCH_EVENT, {
                        workflow_id: workflowRunInfos[0].workflowId,
                        workflow_run_id: workflowRunInfos[0].workflowRunId,
                        task_id: 'onu_event_handler',
                        topic: 'onu.events'
                    });
                });

                workflowRunClient.on(eventrouter.serviceEvents.WORKFLOW_RUN_FETCH_EVENT, (result) => {
                    let event = result.result;
                    expect(event.topic).to.equal('onu.events');
                    expect(event.message.serialNumber).to.equal('testSerialXXX');
                    done();
                });
            }, 2000);
        });

        it('should map a workflow run using key-field', function(done) {
            this.timeout(5000);

            // kickstart the workflow
            probeClient.emit(
                'onu.events',
                {serialNumber: 'testSerialXXX', other: 'test_other_field'}
            );
            probeClient.emit(
                'datamodel.AttWorkflowDriverServiceInstance',
                {operation: 'update', serialNumber: 'testSerialXXX', other: 'updated_test_other_field'}
            );
            setTimeout(() => {
                // kickstart will take 2 seconds roughly
                expect(workflowRunInfos.length, 'num of workflow runs').to.equal(1);
                // the workflow must be 'should_be_called'
                expect(workflowRunInfos[0].workflowId, 'workflow id').to.equal('should_be_called');

                // connect a workflow run client to the server
                let workflowRunClient = io.connect(`http://localhost:${port}`, {
                    query: 'id=workflow_run_id1&type=workflow_run' +
                            `&workflow_id=${workflowRunInfos[0].workflowId}` +
                            `&workflow_run_id=${workflowRunInfos[0].workflowRunId}` +
                            '&name=run1@xos.org'
                });
                workflowRunClients.push(workflowRunClient);

                workflowRunClient.on('connect', () => {
                    // check message counts
                    workflowRunClient.emit(eventrouter.serviceEvents.WORKFLOW_RUN_COUNT_EVENTS, {
                        workflow_id: workflowRunInfos[0].workflowId,
                        workflow_run_id: workflowRunInfos[0].workflowRunId
                    });
                });

                let eventRaised = 0;
                workflowRunClient.on(eventrouter.serviceEvents.WORKFLOW_RUN_COUNT_EVENTS, (result) => {
                    let count = result.result;
                    expect(count, 'number of events queued').to.equal(2);

                    // fetch two events
                    workflowRunClient.emit(eventrouter.serviceEvents.WORKFLOW_RUN_FETCH_EVENT, {
                        workflow_id: workflowRunInfos[0].workflowId,
                        workflow_run_id: workflowRunInfos[0].workflowRunId,
                        task_id: 'onu_event_handler',
                        topic: 'onu.events'
                    });
                    eventRaised++;

                    workflowRunClient.emit(eventrouter.serviceEvents.WORKFLOW_RUN_FETCH_EVENT, {
                        workflow_id: workflowRunInfos[0].workflowId,
                        workflow_run_id: workflowRunInfos[0].workflowRunId,
                        task_id: 'onu_model_event_handler',
                        topic: 'datamodel.AttWorkflowDriverServiceInstance'
                    });
                    eventRaised++;
                });

                workflowRunClient.on(eventrouter.serviceEvents.WORKFLOW_RUN_FETCH_EVENT, (result) => {
                    let event = result.result;
                    if(eventRaised === 2) {
                        expect(event.topic).to.equal('onu.events');
                        expect(event.message.serialNumber).to.equal('testSerialXXX');
                    }
                    else if(eventRaised === 1) {
                        expect(event.topic).to.equal('datamodel.AttWorkflowDriverServiceInstance');
                        expect(event.message.serialNumber).to.equal('testSerialXXX');
                    }
                    eventRaised--;

                    if(eventRaised === 0) {
                        done();
                    }
                });
            }, 2000);
        });
    });
})();
