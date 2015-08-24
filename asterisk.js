'use strict';

/**
 * Service that handles interfacing with the Asterisk AMI AJAX Interface and
 * collecting the current PBX status information.
 */
module.exports = function () {
    var request = require('request');
    var xml2js = require('xml2js');

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    var manager = {};
    var log = console;

    // asterisk control variables
    manager.data = {};

    manager.data.queueStatus = {};
    manager.data.parked = [];
    manager.data.queueSummary = {};
    manager.data.channels = {};

    manager.cookieJar = request.jar();

    var channel = "";
    var tasks = [];
    var activeTask = null;
    var working = false;

    var serverURL = "";
    var username = "";
    var password = "";

    var loginTimeout = 0;
    var loginDuration = 60000; //ms

    var queryInterval = 2000; //ms

    var updateTimer = null;

    manager.start = function (hostname, port, user, pass, interval) {
        serverURL = "http://" + hostname + ":" + port + "/";
        username = user;
        password = pass;
        queryInterval = interval*1000;

        if (!updateTimer) {
            periodicUpdateTask();
            updateTimer = setInterval(periodicUpdateTask, queryInterval);
        }
    };

    manager.stop = function () {
        if (updateTimer) {
            clearInterval(updateTimer);
            updateTimer = null;
        }
    };

    // Originate Call
    manager.originateCall = function (number, account) {
        var params = {
            "Channel": 'SIP/' + extensionNumber,
            "Context": 'default',
            "Exten": number,
            "Priority": 1,
            "Timeout": 30000
        };
        if (account) {
            params['Account'] = account;
        }

        addTask("Originate", params, 'xml');
        log.info("Requested originate from " + extensionNumber + " to " + number);
    };

    function periodicUpdateTask() {
        //log.info("Periodic Update Task");
        if (activeTask) {
            var d = new Date();
            var now = d.getTime();
            var delay = now - activeTask.start;
            if (delay > 5000) {
                if (activeTask.attempt < 3) {
                    // resend the active task
                    log.warn("Resending active task [backup]: " + activeTask.action);
                    sendRequest(activeTask);
                } else {
                    startNextTask();
                }
            }
        }
        addTask("CoreShowChannels", {}, 'xml');
        addTask("QueueSummary", {}, 'xml');
        addTask("QueueStatus", {}, 'xml');
        addTask("ParkedCalls", {}, 'xml');
    }

    // AJAX control function to handle calls to Asterisk server
    function sendRequest(task) {
        //log.info("Sending Request = " + task.action);
        var d = new Date();
        var now = d.getTime();
        task.attempts += 1;
        task.start = now;

        activeTask = task;

        var params = "";
        for(var param in task.params){
            params += "&" + param + "=" + encodeURIComponent(task.params[param]);
        }

        if (task.type == "xml") {
            var path = serverURL + "mxml?action=" + task.action + params;
            log.info("Making " + task.type + " XML request: " + path);
            request({
                uri: path,
                method: "GET",
                timeout: 10000,
                jar: manager.cookieJar,
            }, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    handleCookieUpdate(response);
                    xmlResponseManager(body, task);
                } else {
                    requestErrorHandler('xml', task, error);
                }
            });
        } else {
            var path = serverURL + "rawman?action=" + task.action + params;
            log.info("Making " + task.type + " raw request: " + path);
            request({
                uri: path,
                method: "GET",
                timeout: 10000,
                jar: manager.cookieJar,
            }, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    handleCookieUpdate(response);
                    textResponseManager(body, task);
                } else {
                    requestErrorHandler('text', task, error);
                }
            });
        }
    }

    // extra handler to update the expiration date of cookie when reset
    function handleCookieUpdate(response){
        function addCookie(cookie){
            try {
                var new_cookie = manager.cookieJar.setCookie(cookie, serverURL, {ignoreError: false});
                new_cookie.creation = new Date();
            } catch (e) {
                log.log('Add cookie error.');
                log.error(e);
            }
        }
        if (response.headers['set-cookie']) {
            var headerName = 'set-cookie';
            if (Array.isArray(response.headers[headerName])) {
                response.headers[headerName].forEach(addCookie)
            } else {
                addCookie(response.headers[headerName])
            }
        }
    }

    // AJAX response manager to handle XML responses from the Asterisk server
    function xmlResponseManager(data, task) {
        //var cookie_string = manager.cookieJar.getCookies(serverURL);
        //log.log(cookie_string);
        xml2js.parseString(data, function(err, result){
            if(!err) {
                var state = "";
                var body = [];
                try {
                    body = result['ajax-response']['response'];
                    for (var i = 0; i < body.length; i++) {
                        var object = body[i];
                        var items = object["generic"]
                        for (var j = 0; j < items.length; j++) {
                            var attributes = items[j]["$"];
                            if(attributes) {
                                if (attributes["response"]) {
                                    state = attributes["response"];
                                }
                            }
                        }
                    }
                } catch (exp) {
                    log.error('Encountered xml parse exception finding response: %s', exp);
                }

                if (state == "Success") {
                    updateLoginTimeout(false);
                    switch (task.action) {
                        case "Login":
                            loginResponse(body);
                            break;
                        case "CoreShowChannels":
                            coreShowChannelsResponse(body);
                            break;
                        case "QueueStatus":
                            queueStatusResponse(body);
                            break;
                        case "QueueSummary":
                            queueSummaryResponse(body);
                            break;
                        case "ParkedCalls":
                            parkedCallsResponse(body);
                            break;
                        default:
                            log.warn("Action not supported by xml response manager.");
                    }
                    log.info("Received success response from [" + task.action + "] request.");
                } else {
                    log.warn("AMI XML Request Error = " + data);
                }
            }else{
                log.warn("AMI XML Parse Error = " + error);
            }
            startNextTask();
        });
    }

    function requestErrorHandler(type, task, error) {
        log.warn("Unsuccessful " + task.action + " " + type + " request: " + error);
        if (task.attempts < 3) {
            log.warn("Resending task: " + task.action);
            activeTask = task;
            sendRequest(task);
        } else {
            startNextTask();
        }
    }

    /** AJAX response manager to handle text responses from the Asterisk server
     */
    function textResponseManager(data, task) {
        log.info("Response from server = " + data);
        var lines = data.split("\n");

        if (lines.length > 0) {
            if (lines[0].indexOf("Error") > 0) {
                log.warn("AMI Raw Request Error = " + data);
            } else {
                switch (task.action) {
                    default:
                        log.warn("Action not supported by text response manager.");
                }
            }
        } else {
            log.warn("AMI Raw Request No Content");
        }
        startNextTask();
    }

    function getEvents(data, name){
        var events = [];
        try{
            for (var i = 0; i < data.length; i++) {
                var object = data[i];
                var items = object["generic"]
                for (var j = 0; j < items.length; j++) {
                    var attributes = items[j]["$"];
                    if(attributes) {
                        if (attributes["event"] === name) {
                            delete attributes.event;
                            events.push(attributes);
                        }
                    }
                }
            }
        }catch(exp){
            log.error('Encountered xml parse exception getting events: %s', exp);
        }
        return events;
    }

    /** Task Manager that handles the queue of tasks. */
    // Adds the ACTION and its PARAMS to the tasks queue
    function addTask(action, params, type) {
        var d = new Date();
        var now = d.getTime();
        for (var i = 0; i < tasks.length; i++) {
            if (tasks[i].action == action) {
                //log.warn("Attempted to add duplicate task with action: " + action);
                return;
            }
        }
        var task = {};
        task["action"] = action;
        task["params"] = params;
        task["type"] = type;
        task["start"] = now;
        task["attempts"] = 0;
        tasks.push(task);
        //log.info("Added Task = " + action);
        startTasks();
    }

    //starts the task to send requests
    function startTasks() {
        if (working) {
            return;
        }
        startNextTask();
    }

    // starts the next task in Tasks
    function startNextTask() {
        activeTask = null;
        if (tasks.length == 0) {
            working = false;
            //log.info("All tasks completed");
            return;
        } else if (working == false) {
            working = true;
            //log.info("Starting tasks");
        }

        if (checkLoginRequired()) {
            return;
        }

        var task = tasks.shift();

        //log.info("Dispatching next task");
        sendRequest(task);
    }

    function parkedCallsResponse(data) {
        manager.data.parked = [];
        var events = getEvents(data, "ParkedCall");
        for(var i=0;i<events.length;i++){
            var call = {
                "slot": events[i]["exten"],
                "channel": events[i]["channel"],
                "timeout": events[i]["timeout"],
                "wait": events[i]["duration"],
                "number": events[i]["calleridnum"],
                "name": events[i]["calleridname"],
                "owner": events[i]["connectedlinenum"],
                "ownername": events[i]["connectedlinename"]
            };
            manager.data.parked.push(call);
        }

        log.info('Updated ' + manager.data.parked.length + ' parked calls.');
    }

    // Successful Login Action, updates login timeout
    function loginResponse(data) {
        updateLoginTimeout(true);
        log.info("Successfully logged in");
    }

    // Successful QueueStatus action, parses the queue list for use in app
    function queueStatusResponse(data) {
        manager.data.queueStatus = {};
        var events = getEvents(data, "QueueParams");
        for(var i=0;i<events.length;i++) {
            var queue = events[i]["queue"];
            var name = "Queue";
            manager.data.queueStatus[queue] = {
                "number": queue,
                "name": name,
                "max": events[i]["max"],
                "strategy": events[i]["strategy"],
                "calls": events[i]["calls"],
                "holdtime": events[i]["holdtime"],
                "talktime": events[i]["talktime"],
                "completed": events[i]["completed"],
                "abandoned": events[i]["abandoned"],
                "servicelevel": events[i]["servicelevel"],
                "servicelevelperf": events[i]["servicelevelperf"],
                "weight": events[i]["weight"],
                "extactive": false,
                "extpaused": false,
                "members": [],
                "callers": []
            };
        }
        var events = getEvents(data, "QueueMember");
        for(var i=0;i<events.length;i++) {
            var queue = events[i]["queue"];
            var statusLookup = {
                "1": "Not in Use",
                "2": "In Use",
                "3": "Busy",
                "4": "Unknown",
                "5": "Unavailable",
                "6": "Ringing"
            };
            var status = events[i]["status"];
            if (status != null) {
                status = statusLookup[status];
            }
            var queuePaused = events[i]["paused"] == "1";
            var stateinterface = events[i]["stateinterface"];
            var pattern = /SIP\/(\d*)/;
            var extension = 0;
            try {
                extension = parseInt(pattern.exec(stateinterface)[1]);
            } catch (err) {
            }
            var member = {
                "name": events[i]["name"],
                "location": events[i]["location"],
                "stateinterface": stateinterface,
                "membership": events[i]["membership"],
                "penalty": events[i]["penalty"],
                "callstaken": events[i]["callstaken"],
                "lastcall": events[i]["lastcall"],
                "extension": extension,
                "status": status,
                "paused": queuePaused
            };
            manager.data.queueStatus[queue].members.push(member);
        }

        for (var key in manager.data.queueStatus) {
            var queue = manager.data.queueStatus[key];
            var total = queue["members"].length;
            var available = 0;
            var busy = 0;
            var offline = 0;

            for (var j = 0; j < total; j++) {
                var status = queue["members"][j]["status"];
                if (queue["members"][j].paused) {
                    offline += 1;
                } else {
                    if (status == "Not in Use") {
                        queue["members"][j].active = true;
                        available += 1;
                    } else if (status == "In Use" || status == "Busy") {
                        queue["members"][j].busy = true;
                        busy += 1;
                    } else {
                        offline += 1;
                    }
                }
            }
            queue["stats"] = {
                "total": total,
                "available": available,
                "busy": busy,
                "calls": queue["calls"],
                "offline": offline
            };
            queue["ready"] = (available + busy) > 0;
            queue["full"] = available == 0;
        }

        var count = 0;
        for (var key in manager.data.queueStatus) {
            count++;
            var queue = manager.data.queueStatus[key];
            queue.members.sort(function (a, b) {
                if (a.name > b.name) {
                    return 1;
                }
                if (a.name < b.name) {
                    return -1;
                }
                return 0;
            });
        }
        log.info('Updated ' + count + ' queue statuses.');
    }

    // successful QueueSummary action, parses the queue summary for use in app
    function queueSummaryResponse(data) {
        manager.data.queueSummary = {};
        var events = getEvents(data, "QueueSummary");
        for(var i=0;i<events.length;i++) {
            var queue = events[i]["queue"];
            manager.data.queueSummary[queue] = {
                "number": queue,
                "loggedin": events[i]["loggedin"],
                "available": events[i]["available"],
                "callers": events[i]["callers"],
                "holdtime": events[i]["holdtime"],
                "talktime": events[i]["talktime"],
                "longestholdtime": events[i]["longestholdtime"]
            };
        }
        log.info('Updated ' + events.length + ' queue summaries.');
    }

    // updates the channel currently active
    function coreShowChannelsResponse(data) {
        manager.data.channels = []
        var events = getEvents(data, "CoreShowChannel");
        for(var i=0;i<events.length;i++) {
            manager.data.channels.push(events[i]);
        }
        log.info('Updated ' + manager.data.channels.length + ' channel details.');
    }

    function updateLoginTimeout(force) {
        var d = new Date();
        var remainingTime = loginTimeout - d.getTime();

        if ((remainingTime > 0) || force) {
            loginTimeout = d.getTime() + loginDuration;
        }
    }

    function checkLoginRequired() {
        var d = new Date();
        var update = loginTimeout < d.getTime();
        //log.log('Check Login Required: %s %d %d', update, loginTimeout, d.getTime())
        if (update) {
            sendRequest({
                "action": "Login",
                "params": {"Username": username, "Secret": password},
                "type": "xml",
                "start": d.getTime(),
                "attempts": 0
            });
            return true;
        }
        return false;
    }

    return manager;
};
