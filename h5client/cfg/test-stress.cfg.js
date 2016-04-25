/**
 * test-h5client的配置文件
 */
// 日志服务器地址
var logAddr = 'ws://172.16.2.51:8090/logserver/websocket/log/' + Math.random(); // 172.16.0.154
// DCMP服务器地址
var dcmpAddr = '172.16.2.51:8080/dcmp'; // 172.16.0.21
// Connector服务名（DCMP里配置的Connector名称）
var connector = 'WSConnector';
// 坐席工作模式（ManualIn：ACD呼叫后手动就绪，AutoIn：ACD呼叫后自动就绪）
var autoWorkMode = 'ManualIn'; // ManualIn AutoIn
// 默认登录后状态
var loginMode = 'NotReady'; // Ready NotReady
// 是否打开调试信息
var debug = true;
// 超时时间
var timeout = 30000;
// 心跳间隔
var heartbeatInterval = 60000;
// 虚拟工号前缀
var virtualAgentPrefix = 'NormalAgent';