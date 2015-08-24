# AsteriskProxy 
An Asterisk AMI proxy based on Node.js and the Express web framework.

##About
This application is a basic proxy that collects data on the current state of an Asterisk based PBX and provides 
a HTTP interface for retrieving that data as JSON objects.

##Installing
####Install the prerequsites  
```
sudo yum install nodejs npm
sudo npm -g install forever   
```
####Create the directory in which to install the server  
```
mkdir /opt/AsteriskProxy/
cd /opt/AsteriskProxy/
```
####Fetch the server code and the Node.js dependencies
```
git clone https://github.com/boiceam/AsteriskProxy.git
npm install
```
####Configure the server credentials
```
vi /opt/AsteriskProxy/configuration.json
```
####Install the init script and enable it
```
sudo su
cp astproxy /etc/init.d/astproxy
chmod a+x /etc/init.d/astproxy
chkconfig --add astproxy
chkconfig astproxy on
```
