# AsteriskProxy 
An Asterisk AMI proxy based on the Node.js and the Express web framework.

##About
This application is a basic proxy that collects data on the current state of an Asterisk based PBX and provides 
a interface for retrieving that data as JSON objects.

##Installing
####Install the prerequsites  
```
sudo yum install nodejs   
sudo yum install npm   
sudo npm -g install forever   
```
####Create the directoy in which to install the server  
```
mkdir /opt/AsteriskProxy/
```
####Fetch the server code and the Node.js dependencies
```
cd /opt/AsteriskProxy/
git clone https://github.com/boiceam/AsteriskProxy.git
npm install
```
####Install the init script and enable it
```
sudo su
cp astproxy /etc/init.d/astproxy
chmod a+x /etc/init.d/astproxy
chkconfig --add astproxy
chkconfig astproxy on
```
####Configure the server credentials
```
vi /opt/AsteriskProxy/configuration.json
```