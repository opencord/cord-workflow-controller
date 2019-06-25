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

    class WorkflowTask {
        constructor(id, kickstart=false) {
            this.id = id;
            this.topic = null;
            this.kickstart = kickstart;
            this.keyField = null;
            this.essence = {};
        }

        static fromEssence(essence) {
            if(essence) {
                let workflowTask;
                if('task_id' in essence) {
                    workflowTask = new WorkflowTask(essence.task_id);
                }
                else {
                    logger.log('error', 'task_id is not given');
                    return null;
                }

                if('topic' in essence) {
                    workflowTask.setTopic(essence.topic);
                }

                if('model_name' in essence) {
                    workflowTask.setTopic('datamodel.' + essence.model_name + '.create');
                    workflowTask.setTopic('datamodel.' + essence.model_name + '.update');
                    workflowTask.setTopic('datamodel.' + essence.model_name + '.delete');
                }

                if('key_field' in essence) {
                    workflowTask.setKeyField(essence.key_field);
                }
    
                workflowTask.setEssence(essence);
                return workflowTask;
            }
            else {
                return null;
            }
        }

        setId(id) {
            this.id = id;
        }

        getId() {
            return this.id;
        }

        setTopic(topic) {
            this.topic = topic;
        }

        getTopic() {
            return this.topic;
        }

        setKickstart(kickstart=false) {
            this.kickstart = kickstart;
        }

        isKickstart() {
            return this.kickstart;
        }

        setKeyField(keyField) {
            this.keyField = keyField;
        }
        
        getKeyField() {
            return this.keyField;
        }

        setEssence(essence) {
            this.essence = essence;
        }

        getEssence() {
            return this.essence;
        }

        validate() {
            if(!this.id) {
                logger.log('error', 'id is not given');
                return false;
            }

            // general Airflow operators other than XOS operators don't have these fields.
            // 
            // if(!this.topic) {
            //     logger.log('error', 'topic is not given');
            //     return false;
            // }
    
            // if(!this.keyField) {
            //     logger.log('error', 'keyField is not given');
            //     return false;
            // }
    
            return true;
        }
    }
    
    module.exports = {
        WorkflowTask: WorkflowTask
    };
})();