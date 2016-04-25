/**
 * test-h5client的配置文件
 */
// 日志服务器地址（可选）
var logAddr = 'ws://localhost:8090/logserver/websocket/log/' + Math.random(); // 172.16.0.154


// 服务器连接方式（二选一，优先选择方式一）
var connectType = 1;

// --------------方式1 DCMP服务器地址--------------------
var dcmpAddr = '172.16.2.51:8080/dcmp'; // 172.16.0.21
// Connector服务名（DCMP里配置的Connector名称）
var connector = 'WSConnector';

// --------------方式2 Connector地址---------------------
var connectors = [
      "172.16.2.51:8123",
      "172.16.2.67:8123"
];
// ------------------------------------------------------


// 坐席工作模式（ManualIn：ACD呼叫后手动就绪，AutoIn：ACD呼叫后自动就绪）
var autoWorkMode = 'ManualIn'; // ManualIn AutoIn
// 默认登录后状态
var loginMode = 'NotReady'; // Ready NotReady
// 满意度组号
var satisfaction = '32251'; // 4918
// 是否报工号
var playAgentNo = false;
// 报工号IVR号码
var ivrNo = '32249'; // 40010
// 模拟IVR自动应答挂断(仅测试用)
var simulateIvr = false;
// 是否打开调试信息
var debug = true;
// 是否开启实时排队数
var callsWaiting = true;
// 超时时间
var timeout = 6000;
// 心跳间隔
var heartbeatInterval = 60000;