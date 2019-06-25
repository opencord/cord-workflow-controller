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

    const logger = require('../config/logger.js');

    const TaskStatus = {
        INIT: 'init',
        BEGIN: 'begin',
        END: 'end',
        UNKNOWN: 'unknown'
    };

    class WorkflowRunTask {
        constructor(taskId) {
            this.taskId = taskId;
            this.status = TaskStatus.UNKNOWN;
        }

        static parseStatus(strTaskStatus) {
            if(!strTaskStatus) {
                return TaskStatus.UNKNOWN;
            }
            else if(['i', 'init'].includes(strTaskStatus.toLowerCase())) {
                return TaskStatus.END;
            }
            else if(['b', 'begin', 'start'].includes(strTaskStatus.toLowerCase())) {
                return TaskStatus.BEGIN;
            }
            else if(['e', 'end', 'finish'].includes(strTaskStatus.toLowerCase())) {
                return TaskStatus.END;
            }
            else {
                return TaskStatus.UNKNOWN;
            }
        }

        setTaskId(id) {
            this.taskId = id;
        }

        getTaskId() {
            return this.taskId;
        }

        setStatus(status) {
            let taskStatus = WorkflowRunTask.parseStatus(status);
            this.status = taskStatus;
        }

        getStatus() {
            return this.status;
        }

        validate() {
            if(!this.taskId) {
                logger.log('error', 'id is not given');
                return false;
            }

            if(!this.status) {
                logger.log('error', 'status is not given');
                return false;
            }
    
            return true;
        }
    }
    
    module.exports = {
        TaskStatus: TaskStatus,
        WorkflowRunTask: WorkflowRunTask
    };
})();