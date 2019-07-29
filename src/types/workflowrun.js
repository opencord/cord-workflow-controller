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
    const dateformat = require('dateformat');
    const logger = require('../config/logger.js');

    class WorkflowRun {
        constructor(workflowId, workflowRunId) {
            // workflow run id (dag_run_id)
            this.id = workflowRunId;
            // workflow id
            this.workflowId = workflowId;

            // storing key-field, key-value pairs for <event, workflow run> mapping
            // key: topic
            // value: [{
            //      field:
            //      value:
            // }, ...]
            this.eventKeyFieldValues = {};

            // client ids
            this.clientIds = [];

            // event queue
            // {
            //      topic: topic,
            //      message: message
            // }
            this.eventQueue = [];
            // trash bins
            // dequeued events are sent to this queue
            // for debugging
            this.trashEventQueue = [];

            this.kickstarted = false;
            this.finished = false;
        }

        static makeWorkflowRunId(workflowId) {
            let now = new Date();
            let datetimestr = dateformat(now, 'yyyymmdd_HHMMssl');
            return `${workflowId}_${datetimestr}`;
        }

        static makeNewRun(workflow) {
            let workflowId = workflow.getId();
            let workflowRunId = WorkflowRun.makeWorkflowRunId(workflowId);
            let workflowRun = new WorkflowRun(workflowId, workflowRunId);

            let tasks = workflow.getTasks();
            _.forOwn(tasks, (task, _taskId) => {
                // set key_field / value
                if(task.isCORDTask()) {
                    workflowRun.setEventKeyFieldValue(task.getTopic(), task.getKeyField(), null); // init
                }
            });
            return workflowRun;
        }

        setId(id) {
            this.id = id;
        }

        getId() {
            return this.id;
        }

        setWorkflowId(workflowId) {
            this.workflowId = workflowId;
        }

        getWorkflowId() {
            return this.workflowId;
        }

        setEventKeyFieldValue(topic, field, value=null) {
            let keyFieldValues;
            if(!(topic in this.eventKeyFieldValues)) {
                keyFieldValues = [];
                // put a new empty array
                this.eventKeyFieldValues[topic] = keyFieldValues;
            }
            else {
                keyFieldValues = this.eventKeyFieldValues[topic];
            }

            let index = _.findIndex(keyFieldValues, (keyFieldValue) => {
                return keyFieldValue.field === field;
            });

            if(index >= 0) {
                // update
                keyFieldValues[index] = {
                    field: field,
                    value: value
                };
            }
            else {
                // push a new
                keyFieldValues.push({
                    field: field,
                    value: value
                });
            }
            return true;
        }

        updateEventKeyFieldValueFromMessage(topic, message) {
            if(!(topic in this.eventKeyFieldValues)) {
                logger.log('warn', `cannot find a topic ${topic} in event key field values`);
                return false;
            }

            let keyFieldValues = this.eventKeyFieldValues[topic];
            keyFieldValues.forEach((keyFieldValue) => {
                if(keyFieldValue.field in message) {
                    // has same field in the message
                    // set value
                    keyFieldValue['value'] = message[keyFieldValue.field];
                }
            });
            return true;
        }

        isEventAcceptableByKeyFieldValue(topic, message) {
            if(!(topic in this.eventKeyFieldValues)) {
                // topic does not exist
                return false;
            }

            // check all key-field values
            for(let key in this.eventKeyFieldValues) {
                if (!this.eventKeyFieldValues.hasOwnProperty(key)) {
                    continue;
                }

                let keyFieldValues = this.eventKeyFieldValues[key];
                let arrayLength = keyFieldValues.length;
                for (var i = 0; i < arrayLength; i++) {
                    let keyFieldValue = keyFieldValues[i];

                    if(keyFieldValue.field in message) {
                        // has same field in the message
                        // check value
                        if(keyFieldValue.value === message[keyFieldValue.field]) {
                            // has the same value
                            return true;
                        }
                    }
                }
            }

            // We cannot break the loop when we get the result.
            // because return/break does not work with handler functions
            // _.forOwn(this.eventKeyFieldValues, (keyFieldValues, _topic) => {
            //     keyFieldValues.forEach((keyFieldValue) => {
            //         if(keyFieldValue.field in message) {
            //             // has same field in the message
            //             // check value
            //             if(keyFieldValue.value === message[keyFieldValue.field]) {
            //                 // has the same value
            //                 result = true;
            //             }
            //         }
            //     });
            // });

            return false;
        }

        isEventAcceptable(topic, message) {
            // event is acceped if event has
            // the same key field and its value as workflow_run
            if(this.isEventAcceptableByKeyFieldValue(topic, message)) {
                return true;
            }

            return false;
        }

        addClientId(clientId) {
            if(!this.clientIds.includes(clientId)) {
                this.clientIds.push(clientId);
            }
        }

        removeClientId(clientId) {
            _.pull(this.clientIds, clientId);
        }

        getClientIds() {
            return this.clientIds;
        }

        enqueueEvent(topic, message) {
            this.eventQueue.push({
                topic: topic,
                message: message
            });
        }

        peekEvent() {
            // if the queue is empty, this returns undefined
            if(this.eventQueue.length > 0) {
                return this.eventQueue[0];
            }
            return undefined;
        }

        dequeueEvent() {
            // if the queue is empty, this returns undefined
            if(this.eventQueue.length > 0) {
                let events = _.pullAt(this.eventQueue, [0]);

                // move to trash
                this.trashEventQueue.push(events[0]);
                return events[0];
            }
            return undefined;
        }

        peekEventByTopic(topic) {
            // if the queue is empty, this returns undefined
            let index = _.findIndex(this.eventQueue, (event) => {
                return event.topic === topic;
            });

            if(index >= 0) {
                return this.eventQueue[index];
            }
            return undefined;
        }

        dequeueEventByTopic(topic) {
            // find event by topic.
            // returns only first item in the queue
            // if the queue is empty, this returns undefined
            let index = _.findIndex(this.eventQueue, (event) => {
                return event.topic === topic;
            });

            if(index >= 0) {
                let events = _.pullAt(this.eventQueue, [index]);

                // move to trash
                this.trashEventQueue.push(events[0]);
                return events[0];
            }
            return undefined;
        }

        getTrashEvents() {
            return this.trashEventQueue;
        }

        lengthEventQueue() {
            return this.eventQueue.length;
        }

        setKickstarted() {
            this.kickstarted = true;
        }

        isKickstarted() {
            return this.kickstarted;
        }

        setFinished() {
            this.finished = true;
        }

        isFinished() {
            return this.finished;
        }

        validate() {
            if(!this.id) {
                logger.log('error', 'id is not given');
                return false;
            }

            if(!this.workflowId) {
                logger.log('error', 'workflowId is not given');
                return false;
            }

            return true;
        }
    }

    module.exports = {
        WorkflowRun: WorkflowRun
    };
})();