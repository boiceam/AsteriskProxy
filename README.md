# AsteriskProxy 
An Asterisk AMI proxy based on Node.js and the Express web framework.

##About
This application is a basic proxy that collects data on the current state of an Asterisk based PBX and provides 
a HTTP interface for retrieving that data as JSON objects.

Developed for Asterisk 13.5.0 and CentOS 6.5

##Installing
####Install the prerequsites  
```
yum install nodejs npm git
npm -g install forever   
```
####Fetch the server code and the Node.js dependencies
```
cd /opt/
git clone https://github.com/boiceam/AsteriskProxy.git
npm install
cd /opt/AsteriskProxy/
```
####Configure the server credentials
```
vi /opt/AsteriskProxy/configuration.json
```
####Install the init script and enable it
```
cp astproxy /etc/init.d/astproxy
chmod a+x /etc/init.d/astproxy
chkconfig --add astproxy
chkconfig astproxy on
```
##Usage
####Starting the server
```
service astproxy start
```
####Stoping the server
```
service astproxy stop
```
####Requesting information
All data is requested via HTTP GET requests and is returned as a JSON message.

All collected information:  
```
curl http://127.0.0.1:3000/all/
```  
Current channel information:   
```  
curl http://127.0.0.1:3000/channels/
```  
Current parked calls information:   
```
curl http://127.0.0.1:3000/parked/
```  
Current queue status information:   
```
curl http://127.0.0.1:3000/queueStatus/
```  
Current queue summary information:   
```
curl http://127.0.0.1:3000/queueSummary/
```  


