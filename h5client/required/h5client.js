(function(global, factory) {
	global.H5Client = factory(global);
})(typeof window !== "undefined" ? window : this, function(window) {
	"use strict";
	var Promise = window.Promise;
	var support = {},
		arr = [],
		undefined = window.undefined,
		strundefined = typeof undefined,
		noop = function() {},
		GUID = 0,
		version = "2.2.6";
	// 全局设置
	var settings = {
		// 超时时间
		timeout: 6e3,
		// 心跳间隔
		heartbeatInterval: 5e3,
		// 最大重连间隔时间
		maxReconnectInterval: 3e4,
		// 初始重连间隔时间
		reconnectInterval: 1e3,
		// 重连间隔时间衰减
		reconnectDecay: 1.5,
		// 暂时无效
		timeoutInterval: 2e3,
		// 最大重试次数，null为无限重试
		maxReconnectAttempts: null,
		// 默认坐席登录状态
		loginMode: "NotReady",
		// 坐席工作模式
		autoWorkMode: "ManualIn",
		// AutoIn ManualIn
		// DCMP服务器地址，无需修改
		dcmpAddr: "http://{0}/action/Dcmp.queryService/{1}",
		// Connect服务器地址，无需修改
		serverAddr: "{protocol}//{hostAndPort}/websocket",
		// 日志服务器地址
		logAddr: "ws://localhost:8083/websocket/log/" + Math.random(),
		// 非多会话，刷新可以重连，通话也可以登录
		multipleSession: false,
		// 实时统计服务名称（查询技能组用到）
		realtimeStat: 'RTStat',
		debug: false
	};
	/**
	 * 日志记录器
	 */
	var logger = function() {
			var ws = null,
				logIndex = 0;
			return {
				open: function() {
					if ("WebSocket" in window) {
						try {
							ws = new WebSocket(settings.logAddr);
						} catch (e) {}
					} else if ("MozWebSocket" in window) {
						try {
							ws = new MozWebSocket(settings.logAddr);
						} catch (e) {}
					} else {
						alert("not support WebSocket");
					}
					if (!ws) return;

					ws.onmessage = function(e) {};
					ws.onopen = function(e) {
						console.info("Logger opened");
					};
					ws.onclose = function(e) {
						ws.onmessage = null;
						ws.onopen = null;
						ws.onclose = null;
						ws.onerror = null;
						ws = null;
						console.info("Logger closed");
					};
					ws.onerror = function(e) {};
				},
				log: function(text) {
					if (settings.debug) {
						var outputText = typeof text == "object" ? JSON.stringify(text) : text;
						console.log(outputText);
						if (!ws) return;
						try {
							ws.send("1000000" + (outputText));
						} catch (e) {}
					}
				},
				info: function(text) {
					if (settings.debug) {
						var outputText = typeof text == "object" ? JSON.stringify(text) : text;
						console.info(outputText);
						if (!ws) return;
						try {
							ws.send("2000000" + (outputText));
						} catch (e) {}
					}
				},
				warn: function(text) {
					if (settings.debug) {
						var outputText = typeof text == "object" ? JSON.stringify(text) : text;
						console.warn(outputText);
						if (!ws) return;
						try {
							ws.send("3000000" + (outputText));
						} catch (e) {}
					}
				},
				error: function(text) {
					if (settings.debug) {
						var outputText = typeof text == "object" ? JSON.stringify(text) : text;
						console.error(outputText);
						if (!ws) return;
						try {
							ws.send("4000000" + (outputText));
						} catch (e) {}
					}
				}
			};
		}();
	var $ = {
		version: version,
		/**
		 * 继承原型
		 *
		 * @param subType
		 *            子类型
		 * @param superType
		 *            父类型
		 */
		inheritPrototype: function(subType, superType) {
			var prototype = Object.create(superType.prototype);
			prototype.constructor = subType;
			subType.prototype = prototype;
		},
		extend: function(tar, src) {
			for (var name in src) {
				if (src.hasOwnProperty(name)) {
					tar[name] = src[name];
				}
			}
			return tar;
		},
		openLog: function(addr) {
			logger.open(addr);
		},
		ajax: function(url, options) {
			return new Promise(function(resolve, reject) {
				options = options || support;
				var async = options.async !== false,
					method = options.method || "GET",
					data = options.data || null,
					timeout = options.timeout || settings.timeout;
				method = method.toUpperCase();
				if (method == "GET" && data) {
					url += (url.indexOf("?") == -1 ? "?" : "&") + data;
					data = null;
				}
				var timer = 0;
				timer = window.setTimeout(function() {
					window.clearTimeout(timer);
					timer = 0;
					reject(new Error(new Error(Error.DCMP_CONNECTION_FAILED, {
						dcmp: url
					})));
				}, timeout);
				var xhr = new window.XMLHttpRequest();
				// 支持超时设置就设置
				try {
					xhr.timeout = timeout;
				} catch (e) {}
				xhr.onreadystatechange = function() {
					if (xhr.readyState == 4) {
						var s = xhr.status;
						if (timer) {
							window.clearTimeout(timer);
							timer = 0;
							if (s >= 200 && s < 300) {
								resolve(xhr);
							} else {
								if (s == 400 || !s) {
									reject(new Error(new Error(Error.DCMP_CONNECTION_FAILED, {
										dcmp: url
									})));
								} else {
									reject(new Error(Error.NO_AVAILABLE_SERVER));
								}
							}
						}
					}
				};
				xhr.open(method, url, async);
				if (method == "POST") {
					xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded;");
				}
				xhr.send(data);
			});
		},
		format: function(template, args) {
			if (arguments.length > 1 && typeof arguments[0] === "string") {
				var result = arguments[0];
				if (arguments.length == 2 && typeof arguments[1] === "object") {
					var obj = arguments[1];
					for (var key in obj) {
						if (obj[key] != undefined) {
							var reg = new RegExp("({" + key + "})", "g");
							result = result.replace(reg, obj[key]);
						}
					}
				} else {
					for (var i = 1, len = arguments.length; i < len; i++) {
						if (arguments[i] != undefined) {
							// 这个在索引大于9时会有问题
							// var reg = new RegExp("({[" + (i - 1) + "]})", "g");
							var reg = new RegExp("({)" + (i - 1) + "(})", "g");
							result = result.replace(reg, arguments[i]);
						}
					}
				}
				return result;
			} else {
				return arguments[0];
			}
		},
		dateDiff: function(startTime, EndTime) {
			if (!EndTime) {
				EndTime = Date.now();
			}
			var res = {
				D: 0,
				H: 0,
				M: 0,
				S: 0,
				MS: 0
			};
			var restTime = EndTime - startTime;
			res.D = Math.floor(restTime / 864e5);
			restTime = restTime - res.D * 864e5;
			res.H = Math.floor(restTime / 36e5);
			restTime = restTime - res.H * 36e5;
			res.M = Math.floor(restTime / 6e4);
			restTime = restTime - res.M * 6e4;
			res.S = Math.floor(restTime / 1e3);
			restTime = restTime - res.S * 1e3;
			res.MS = restTime;
			return res;
		}
	};
	var Event = function() {
			this.events = {};
		};
	Event.prototype = {
		constructor: Event,
		// 是否需要支持冒泡？？？
		/**
		 * 监听事件
		 *
		 * @param strtypes
		 *            事件类型，支持多事件（”,“隔开），命名空间（”.“隔开，用于移除事件），如：'session.Open,
		 *            session.Close'
		 * @param fn
		 *            处理函数
		 * @param level
		 *            触发优先级，0最高（内部级别），数值越大级别越低
		 */
		on: function(strtypes, fn, /* INTERNAL */ level) {
			var namespaces, namespace, type, origType;
			if (level === undefined) level = 1;
			// 事件完整路径列表
			namespaces = strtypes.toUpperCase().split(",");
			// 循环列表
			for (var i = 0; i < namespaces.length; i++) {
				// 取出命名空间
				namespace = namespaces[i].trim().split(".");
				// 禁用通配符
				if (namespace["*"]) continue;
				// 取出事件类型
				type = namespace.pop();
				// 搜索事件
				origType = this.events[type];
				// 不存在则创建事件
				if (!origType) origType = this.events[type] = [];
				// 不存在则创建级别
				if (!origType[level]) origType[level] = [];
				// 将事件按级别加入列表
				origType[level].push({
					namespace: namespace,
					fn: fn
				});
			}
		},
		/**
		 * 监听事件只触发一次
		 *
		 * @param strtypes
		 *            事件类型
		 * @param fn
		 *            处理函数
		 */
		one: function(strtypes, fn, /* INTERNAL */ level) {
			var that = this;
			var origFn = fn;
			fn = function() {
				that.off(strtypes, fn, /* INTERNAL */ level);
				origFn.apply(fn, arguments);
			};
			this.on(strtypes, fn, level);
		},
		/**
		 * 移除事件
		 *
		 * @param strtypes
		 *            事件类型，支持多事件（”,“隔开），命名空间（”.“隔开，用于移除事件），支持通配符“*”，
		 *            如：'session.*'，匹配如'session.Opened'；'user.*.Opened'，匹配如'user.agent.Opened'；'Opened'，匹配所有'Opened'事件
		 * @param fn
		 *            可选参数：处理函数，省略将移除事件上的所有处理函数
		 * @param level
		 *            内部必选参数，外部可选参数：触发优先级，省略将在除内部级别0的所有级别上搜索
		 */
		off: function(strtypes, fn, /* INTERNAL */ level) {
			if (typeof fn === "number") {
				level = fn;
				fn = undefined;
			}
			var namespaces, namespace, type, event, origType, origLevel, origIndex;
			// 事件完整路径列表
			namespaces = strtypes.toUpperCase().split(",");
			// 循环列表
			for (var i = 0; i < namespaces.length; i++) {
				// 取出命名空间
				namespace = namespaces[i].trim().split(".");
				// 取出事件类型
				type = namespace.pop();
				if (type != "*") {
					// 搜索事件
					event = this.events[type];
					// 不存在则执行下一次循环
					if (!event || event.length === 0) continue;
				}
				// 循环所有事件
				for (var key in this.events) {
					origType = event || this.events[key] || arr;
					// 循环事件级别，无级别参数则从1开始
					for (var i = typeof level !== strundefined ? level : 1; i < origType.length; i++) {
						origLevel = origType[i] || arr;
						// 循环级别中索引
						indexLoop: for (var j = 0; j < origLevel.length; j++) {
							origIndex = origLevel[j] || arr;
							if (fn && origIndex.fn !== fn) {
								continue;
							} else {
								// 无命名空间将删除所有
								if (!namespace.length) {
									delete origLevel[j];
									continue indexLoop;
								}
								// 循环源命名空间
								var origNs = origIndex.namespace || arr;
								if (origNs.length !== namespace.length) continue indexLoop;
								for (var k = 0; k < origNs.length; k++) {
									if (namespace[k] == "*") continue;
									// 比较命名空间
									if (namespace[k] !== origNs[k]) continue indexLoop;
								}
								delete origLevel[j];
							}
						}
						if (typeof level !== strundefined) break;
					}
					if (event) break;
				}
			}
		},
		/**
		 * 触发事件
		 *
		 * @param strtypes
		 * @param data
		 */
		trigger: function(strtypes, data) {
			console.log(strtypes);
			var types, origType;
			// 事件类型数组
			types = strtypes.toUpperCase().split(",");
			// 循环数组
			for (var i = 0; i < types.length; i++) {
				// 搜索事件
				origType = this.events[types[i].trim()];
				// 不存在则返回
				if (!origType) return;
				// 按事件级别触发事件
				for (var i = 0; i < origType.length; i++) {
					if (!origType[i]) continue;
					for (var j = 0; j < origType[i].length; j++) {
						var orig = origType[i][j];
						if (orig && typeof orig.fn === "function") {
							orig.fn(data || support);
						}
					}
				}
			}
		}
	};
	var Error = function(error, args) {
			return this.init(error, args);
		};
	Error.INVOKE_TIMEOUT = {
		code: 400,
		name: "INVOKE_TIMEOUT",
		message: "请求超时 - {method}",
		type: "client"
	};
	Error.SOCKET_NOT_OPEN = {
		code: 401,
		name: "SOCKET_NOT_OPEN",
		message: "连接未建立",
		type: "client"
	};
	Error.SESSION_NOT_ALIVE = {
		code: 402,
		name: "SESSION_NOT_ALIVE",
		message: "会话未建立",
		type: "client"
	};
	Error.STATION_NOT_MONITORED = {
		code: 403,
		name: "STATION_NOT_MONITORED",
		message: "分机未监视",
		type: "connector"
	};
	Error.DCMP_CONNECTION_FAILED = {
		code: 404,
		name: "DCMP_CONNECTION_FAILED",
		message: "DCMP连接失败：{dcmp}",
		type: "connector"
	};
	Error.SERVER_CONNECTION_FAILED = {
		code: 405,
		name: "SERVER_CONNECTION_FAILED",
		message: "服务器连接失败：{server}",
		type: "client"
	};
	Error.NO_AVAILABLE_SERVER = {
		code: 406,
		name: "NO_AVAILABLE_SERVER",
		message: "没有可用的服务器",
		type: "client"
	};
	Error.INVALID_STATE_ERR = {
		code: 407,
		name: "INVALID_STATE_ERR",
		message: "无效的状态",
		type: "client"
	};
	Error.NO_DEVICE_INFO = {
		code: 410,
		name: "NO_DEVICE_INFO",
		message: "未获取到分机信息",
		type: "client"
	};
	Error.UNKNOW_ERROR = {
		code: 426,
		name: "UNKNOW_ERROR",
		message: "未知错误",
		type: "connector"
	};
	Error.EXIST_AGENT_LOGIN = {
		code: 411,
		name: "EXIST_AGENT_LOGIN",
		message: "工号已登录，登录分机：{deviceId}",
		type: "connector"
	};
	Error.EXIST_DEVICE_LOGIN = {
		code: 412,
		name: "EXIST_DEVICE_LOGIN",
		message: "分机已登录，登录工号：{agentId}",
		type: "connector"
	};
	Error.NOT_LOGGED_IN = {
		code: 413,
		name: "NOT_LOGGED_IN",
		message: "未登录",
		type: "connector"
	};
	Error.INVALID_DEVICE_ID = {
		code: 414,
		name: "INVALID_DEVICE_ID",
		message: "无效的分机号：{deviceId}",
		type: "connector"
	};
	Error.INVALID_AGENT_ID = {
		code: 415,
		name: "INVALID_AGENT_ID",
		message: "无效的工号：{agentId}",
		type: "connector"
	};
	Error.INVALID_PASSWORD = {
		code: 416,
		name: "INVALID_PASSWORD",
		message: "无效的密码",
		type: "{type}"
	};
	Error.RESOURCE_BUSY = {
		code: 33,
		name: "RESOURCE_BUSY",
		message: "分机正在通话",
		type: "{type}"
	};
	Error.prototype = {
		constructor: Error,
		init: function(error, args) {
			var newError = null;
			if (typeof error === "object") {
				if (typeof args != undefined) {
					newError = Object.create(error);
					for (var name in newError) {
						newError[name] = $.format(newError[name], args);
					}
				} else {
					newError = error;
				}
			} else if (typeof error === "string") {
				newError = {
					code: 499,
					name: "Error",
					message: error,
					type: "connector"
				};
			}
			if (typeof $.onerror === "function") $.onerror(newError);
			return newError;
		}
	};
	/**
	 * 对象与JSON消息互转
	 */
	var Converter = function() {
			/**
			 * 补位数组
			 */
			var tbl = [];
			/**
			 * 左侧补位，补'0'
			 *
			 * @param num
			 *            原始数据
			 * @param n
			 *            补位长度
			 * @return {String} 新字符串
			 */
			var padLeft = function(num, n) {
					return 0 >= (n = n - num.toString().length) ? num : (tbl[n] || (tbl[n] = Array(n + 1).join("0"))) + num;
				};
			/**
			 * 右侧补位，补' '
			 *
			 * @param num
			 *            原始数据
			 * @param n
			 *            补位长度
			 * @return {String} 新字符串
			 */
			var padRight = function(num, n) {
					return 0 >= (n = n - num.toString().length) ? num : num + (tbl[n] || (tbl[n] = Array(n + 1).join(" ")));
				};
			return {
				/**
				 * 编码
				 *
				 * @param 要编码的对象
				 * @returns 编码后的字符串
				 */
				encode: function(invokeId, options) {
					var jsonString = JSON.stringify(options);
					return padRight( // 消息头，64位
					"CT40" + "01" + padLeft(jsonString.length, 8) + padLeft(invokeId, 8), 64) + jsonString;
				},
				/**
				 * 解码
				 *
				 * @param json
				 *            要解码的字符串
				 * @returns 解码后的对象
				 */
				decode: function(json) {
					var head = json.substring(0, 64);
					var pdu = json.substring(64);
					return {
						head: head.substring(0, 4),
						type: head.substring(4, 6),
						size: Number(head.substring(6, 14)),
						invokeId: Number(head.substring(14, 22)),
						data: JSON.parse(pdu)
					};
				}
			};
		}();
	var Socket = function(session) {
			this.session = session;
			this.ws = null;
			this.forcedClose = false;
			this.queue = {};
		};
	// attach
	Socket.invokeId = 0;
	Socket.generateInvokeId = function() {
		++Socket.invokeId;
		if (Socket.invokeId > 99999999) {
			Socket.invokeId = 1;
		}
		return Socket.invokeId;
	};
	Socket.special = {
		initSession: "SessionStart"
	}, Socket.prototype = {
		constructor: Socket,
		converter: Converter,
		open: function(url, options) {
			logger.log("socket - open - Connecting to " + url);
			var that = this;
			options = options || support;
			var timeout = options.timeout || settings.timeout;
			return new Promise(function(resolve, reject) {
				that.close();
				var ws;
				var timer = setTimeout(function() {
					that.close();
					reject(new Error(Error.SERVER_CONNECTION_FAILED, {
						server: url
					}));
				}, timeout);
				// 创建WebSocket
				if ("WebSocket" in window) {
					// IE10/11/edge 浏览器限制了到单个服务器最大并发websocket的数量，
					// 这个数字的缺省值是6，超过数量会报 SecurityError 错误
					ws = new WebSocket(url);
				} else if ("MozWebSocket" in window) {
					ws = new MozWebSocket(url);
				} else {
					window.clearTimeout(timer);
					timer = 0;
					that.close();
					reject(new Error("not support WebSocket"));
					alert("not support WebSocket");
					return;
				}
				// 收到消息时触发
				ws.onmessage = function(e) {
					logger.info("WebSocket message");
					that.recv(e);
				};
				// 打开时触发
				ws.onopen = function(e) {
					logger.info("WebSocket opened");
					that.forcedClose = false;
					window.clearTimeout(timer);
					timer = 0;
					resolve(e);
				};
				// 关闭时触发
				ws.onclose = function(e) {
					logger.info("WebSocket closed");
					if (!that.forcedClose) {
						if (timer) {
							window.clearTimeout(timer);
							timer = 0;
							reject(new Error(Error.SERVER_CONNECTION_FAILED, {
								server: url
							}));
						} else {
							that.session.event.trigger("Disconnected");
						}
					} else {
						for (var invokeId in that.queue) {
							var invoke = that.queue[invokeId];
							if (invoke.method == "close") {
								// 清除超时检测定时器
								that.stopCheckTimedOut(invokeId);
								invoke.resolve();
							}
						}
					}
				};
				// 错误时触发
				ws.onerror = function(e) {
					logger.warn("WebSocket error");
				};
				that.ws = ws;
			});
		},
		checkTimedOut: function(invokeId, timeout) {
			var that = this;
			var invoke = that.queue[invokeId];
			invoke.timer = window.setTimeout(function() {
				if (invoke.method == "close") return;
				logger.warn("timeout - 请求超时 - " + invoke.method);
				// 发送超时消息
				invoke.reject(new Error(Error.INVOKE_TIMEOUT, {
					method: invoke.method
				}));
				// 删除请求队列中的对象
				delete that.queue[invokeId];
			}, timeout);
		},
		stopCheckTimedOut: function(invokeId) {
			var invoke = this.queue[invokeId];
			if (invoke && invoke.timer) {
				window.clearTimeout(invoke.timer);
				invoke.timer = 0;
			}
			delete this.queue[invokeId];
		},
		send: function(data, options) {
			var that = this;
			var options = options || support;
			var timeout = options.timeout || settings.timeout;
			var queue = that.queue;
			// 检查WebSocket是否打开
			if (!that.ws || that.ws.readyState != WebSocket.OPEN) {
				// 发送错误消息
				return Promise.reject(new Error(Error.SOCKET_NOT_OPEN));
			}
			var str = that.converter.encode(Socket.generateInvokeId(), data);
			var promise = new Promise(function(resolve, reject) {
				// 向请求队列中添加对象
				queue[Socket.invokeId] = {
					method: data.method,
					// 超时检测定时器
					timer: null,
					resolve: resolve,
					reject: reject
				};
				that.checkTimedOut(Socket.invokeId, timeout);
				logger.info("request - " + str);
				that.ws.send(str);
			});
			return promise;
		},
		/**
		 * 消息处理
		 *
		 * @param e
		 */
		recv: function(e) {
			var queue = this.queue;
			// 解析为对象
			var response = this.converter.decode(e.data);
			var data = response.data;
			// 判断消息类型
			switch (response.type) {
			case "99":
				if (this.session.sessionId != data.properties._sessionId) return;
				logger.info("change  - " + e.data);
				// 发布消息
				this.session.event.trigger(data.name, data.properties);
				if (data.name == "agentLoggedOn" || data.name == "agentReady" || data.name == "agentNotReady" || data.name == "agentLoggedOff" || data.name == "agentWorkingAfterCall") {
					this.session.event.trigger("AgentStateChange", data.properties);
				} else if (data.name != "snapshot") {
					this.session.event.trigger("StationStateChange", data);
				};
				break;

			case "10":
				var invoke = queue[response.invokeId];
				if (!invoke) return;
				logger.info("success - " + e.data);
				// 清除超时检测定时器
				this.stopCheckTimedOut(response.invokeId);
				// 执行回调
				var name = "";
				(name = Socket.special[data.method]) && this.session.event.trigger(name, data.ret);
				invoke.resolve(data.ret);
				// this.onsuccess(response.data,
				// invoke.options.success);
				break;

			case "11":
				var invoke = queue[response.invokeId];
				if (!invoke) return;
				logger.error("failure - " + e.data);
				this.stopCheckTimedOut(response.invokeId);
				var msg = data.errMessage;
				var error = null;
				if (!msg || msg == "null") {
					error = new Error(Error.UNKNOW_ERROR);
				} else if (msg.match(/invalid deviceid:/)) {
					error = new Error(Error.INVALID_DEVICE_ID, {
						deviceId: msg.match(/[^invalid deviceid:]+/)
					});
				} else if (data.errMessage.match(/invalid agent id:/)) {
					error = new Error(Error.INVALID_AGENT_ID, {
						agentId: msg.match(/[^invalid agent id:]+/)
					});
				} else if (data.errMessage.match(/invalid password/)) {
					error = new Error(Error.INVALID_PASSWORD, {
						type: "connector"
					});
				} else if (data.errMessage.match(/CTIException/)) {
					var name = msg.match(/CTIException\(\(\d+\)\s(.*)\):.*/)[1];
					if ($.Error[name]) {
						error = new Error(Error[name]);
					} else {
						var code = Number(msg.match(/CTIException\(\((\d+).*/)[1]);
						var name = msg.match(/CTIException\(\(\d+\)\s(.*)\):.*/)[1];
						error = new Error({
							code: code,
							name: name,
							message: "CTI请求异常(" + code + ")" + name,
							type: "cti"
						});
					}
				} else {
					error = new Error(msg);
				}
				invoke.reject(error);
				break;

			default:
				logger.warn("unknow  -" + e.data);
				break;
			}
		},
		close: function() {
			this.forcedClose = true;
			// '1006','reason'
			if (this.ws) {
				this.ws.onopen = null;
				this.ws.onclose = null;
				this.ws.onmessage = null;
				this.ws.onerror = null;
				if (this.ws != WebSocket.CLOSED && this.ws != WebSocket.CLOSING) {
					this.ws.close("1000", "reason");
				}
			}
		}
	};
	var Call = function() {
			this.callId = "";
			this.contactId = "";
			this.state = 0;
			this.createTime = 0;
			this.answerTime = 0;
			this.ani = "";
			this.dnis = "";
			this.callType = "";
			this.deviceId = "";
			this.direction = "";
			// In Out
			this.trunkGroup = "";
			this.trunkMember = "";
			this.isHeld = false;
			this.isReached = false;
			this.queue = "";
		};
	Call.OFFHOOK = 1;
	Call.DIALING = 2;
	Call.RINGING = 3;
	Call.CONNECTED = 4;
	Call.ESTABLISHED = 4;
	Call.FAILED = 9;
	var Calls = function() {
			Array.apply(this, arguments);
			this.activeCall = "";
			this.consultationType = "";
			this.consultationFrom = "";
			this.consultationTo = "";
		};
	$.inheritPrototype(Calls, Array);
	Calls.prototype.add = function(call) {
		call = call || support;
		// callId存在-> 列表中没找到callId -> 新建一个Call对象 -> 将新建的对象添加进列表
		if (typeof call.callId !== strundefined) {
			var origCall = this.get(call.callId);
			if (!origCall) {
				origCall = new Call();
				this.push(origCall);
			}
			for (var key in origCall) {
				typeof call[key] !== strundefined && (origCall[key] = call[key]);
			}
		}
	};
	Calls.prototype.remove = function(callId) {
		for (var i = 0, len = this.length; i < len; i++) {
			if (this[i].callId == callId && this.splice(i, 1)) return;
		}
	};
	Calls.prototype.removeIndex = function(index) {
		this.splice(index, 1);
	};
	Calls.prototype.clear = function() {
		this.length = 0;
	};
	Calls.prototype.clearConsultation = function() {
		this.consultationFrom = "";
		this.consultationTo = "";
		this.consultationType = "";
	};
	Calls.prototype.get = function(callId) {
		for (var i = 0, len = this.length; i < len; i++) {
			if (this[i].callId == callId) return this[i];
		}
		return null;
	};
	Calls.prototype.getIndex = function(index) {
		return this[index] || null;
	};
	Calls.prototype.getLast = function(index) {
		return this[this.length - 1] || null;
	};
	Calls.prototype.indexOf = function(callId) {
		for (var i = 0, len = this.length; i < len; i++) {
			if (this[i].callId == callId) return i;
		}
		return -1;
	};
	Calls.prototype.size = function() {
		return this.length;
	};
	Calls.prototype.replace = function(callId, call) {
		call = call || {};
		var origCall = this.get(callId) || support;
		for (var key in origCall) {
			typeof call[key] !== strundefined && (origCall[key] = call[key]);
		}
	};
	/**
	 * 过滤符合条件的所有电话列表
	 *
	 * @param call
	 *            电话条件对象
	 * @returns {Calls} 电话对象
	 */
	Calls.prototype.filter = function(call) {
		call = call || {};
		var calls = new Calls();
		// 命名循环
		callsLoop: for (var i = 0, len = this.length; i < len; i++) {
			for (var key in call) {
				if (typeof this[i][key] === strundefined || this[i][key] != call[key]) continue callsLoop;
			}
			calls.push(this[i]);
		}
		return calls;
	};
	var Agent = function() {
			this.agentId = "";
			this.loginName = "";
			this.mode = 0;
			// this.session = session;
			// Object.defineProperty(this, 'mode', {
			// set: function (x) {
			// this._mode = x;
			// this.session.event.trigger('AgentStateChange',this);
			// },
			// get: function () {
			// return this._mode;
			// },
			// enumerable: true,
			// configurable: true
			// });
			this.lastMode = 0;
			this.lastTime = 0;
			this.loginTime = 0;
			this.logoutTime = 0;
			this.autoWorkMode = "";
			this.reason = "";
			this.curQueue = "";
			this.queues = [];
			this.password = "";
		};
	Agent.PENDING = "";
	Agent.LOGIN = "Login";
	Agent.LOGOUT = "Logout";
	Agent.NOT_READY = "NotReady";
	Agent.READY = "Ready";
	Agent.WORK_NOT_READY = "WorkNotReady";
	Agent.WORK_READY = "WorkReady";
	var Group = function(session) {
			this.guid = ++GUID;
			this.session = session;
			this.state = 0;
			this.deviceId = "";
			this.initialized = false;
			this.availableAgents = 0;
			this.loggedInAgents = 0;
			this.otherAgents = 0;
			this.onCallInAgents = 0;
			this.callsInQueue = 0;
			this.onCallOutAgents = 0;
			this.allAgents = "";
			this.workNotReadyAgents = 0;
			this.notReadyAgents = 0;
		};
	Group.prototype = {
		constructor: Group,
		init: function() {
			if (this.initialized) return;
			logger.log("group - init");
			var that = this;
			var event = this.session.event;
			var groupOid = "group" + that.guid;
			// 订阅消息
			event.on(groupOid + ".Snapshot", function(e) {
				if (e.srcDeviceId != that.deviceId) return;
				that.availableAgents = e.availableAgents;
				that.loggedInAgents = e.loggedInAgents;
				that.otherAgents = e.otherAgents;
				that.onCallInAgents = e.onCallInAgents;
				that.callsInQueue = e.callsInQueue;
				that.onCallOutAgents = e.onCallOutAgents;
				that.allAgents = e.allAgents;
				that.workNotReadyAgents = e.workNotReadyAgents;
				that.notReadyAgents = e.notReadyAgents;
			}, 0);
			// 监控丢失
			event.on(groupOid + ".MonitorCancelled", function(e) {
				if (e.srcDeviceId != that.deviceId) return;
				that.state = Station.CANCELLED;
			}, 0);
			// 监控恢复
			event.on(groupOid + ".MonitorRecovered", function(e) {
				if (e.srcDeviceId != that.deviceId) return;
				that.state = Station.MONITORED;
			}, 0);
			that.initialized = true;
		},
		monitor: function(deviceId) {
			var that = this;
			logger.log("group - monitor:" + deviceId);
			if (that.session.state != Session.ALIVE) {
				return Promise.reject(new Error(Error.SESSION_NOT_ALIVE));
			} else {
				return that.session.socket.send({
					method: "monitorDevice",
					object: "cti",
					params: [deviceId]
				}).then(function(e) {
					that.deviceId = deviceId;
					that.state = Station.MONITORED;
					that.session.stations.push(that);
					that.init();
				});
			}
		},
		stopMonitor: function() {
			var that = this;
			logger.log("group - stopMonitor");
			// 从Session中移除
			var stations = that.session.stations;
			var index = stations.indexOf(that);
			if (index >= 0) {
				stations.splice(index, 1);
			}
			if (that.state == Station.PENDING) {
				return Promise.resolve();
			} else {
				if (that.session.state != Session.ALIVE) {
					that.destory();
					return Promise.resolve();
				} else {
					var stations = that.session.stations;
					for (var i = 0; i < stations.length; i++) {
						if (stations[i] != that && stations[i].deviceId == deviceId && stations[i].state != Station.PENDING) {
							that.destory();
							return Promise.resolve();
						}
					}
					// that.state = Station.STOPPING;
					return that.session.socket.send({
						method: "stopMonitorDevice",
						object: "cti",
						params: [that.deviceId]
					}).then(function(e) {
						that.destory();
					});
				}
			}
		},
		destory: function() {
			logger.log("group - destory");
			var that = this;
			that.session.event.off("group" + that.guid + ".*", 0);
			that.state = Station.PENDING;
			that.initialized = false;
		}
	};
	// 监视
	// 监视分机 监视坐席
	// 坐席
	// 监视分机
	var Station = function(session, monitorMode) {
			this.guid = ++GUID;
			this.session = session;
			this.state = 0;
			this.deviceId = "";
			this.loginMode = "";
			this.calls = new Calls();
			this.agent = new Agent();
			this.monitorMode = monitorMode;
			this.initialized = false;
		};
	Station.PENDING = 0;
	Station.MONITORED = 1;
	Station.CANCELLED = 2;
	Station.RECOVERING = 3;
	Station.STOPPING = 4;
	Station.MONITOR_DEVICE = 0;
	Station.MONITOR_AGENT = 1;
	Station.MODE_EVENT_MAP = {
		Login: "AgentLoggedOn",
		Logout: "AgentLoggedOff",
		NotReady: "AgentNotReady",
		Ready: "AgentReady",
		WorkNotReady: "AgentWorkingAfterCall",
		WorkReady: ""
	};
	Station.prototype = {
		constructor: Station,
		
		init: function() {
			if (this.initialized) return;
			var that = this;
			var agent = that.agent;
			var event = this.session.event;
			var stationOid = "station" + that.guid;
			// 订阅消息
			event.on(stationOid + ".AgentLoggedOn", function(e) {
				if (e.srcDeviceId != that.deviceId) return;
				agent.lastMode = agent.mode;
				agent.mode = Agent.LOGIN;
				agent.lastTime = agent.loginTime = Date.now();
			}, 0);
			// 坐席就绪消息
			event.on(stationOid + ".AgentReady", function(e) {
				if (e.srcDeviceId != that.deviceId) return;
				agent.lastMode = agent.mode;
				agent.mode = Agent.READY;
				agent.lastTime = Date.now();
			}, 0);
			// 坐席后处理消息
			event.on(stationOid + ".AgentWorkingAfterCall", function(e) {
				if (e.srcDeviceId != that.deviceId) return;
				agent.lastMode = agent.mode;
				agent.lastTime = Date.now();
				agent.mode = Agent.WORK_NOT_READY;
			}, 0);
			// 坐席未就绪消息
			event.on(stationOid + ".AgentNotReady", function(e) {
				if (e.srcDeviceId != that.deviceId) return;
				agent.lastMode = agent.mode;
				agent.lastTime = Date.now();
				agent.mode = Agent.NOT_READY;
			}, 0);
			// 坐席退出消息
			event.on(stationOid + ".AgentLoggedOff", function(e) {
				if (e.srcDeviceId != that.deviceId) return;
				agent.lastMode = agent.mode;
				agent.lastTime = agent.logoutTime = Date.now();
				agent.mode = Agent.LOGOUT;
			}, 0);
			// 监控丢失
			event.on(stationOid + ".MonitorCancelled", function(e) {
				if (e.srcDeviceId != that.deviceId) return;
				that.state = Station.CANCELLED;
			}, 0);
			// 监控恢复
			event.on(stationOid + ".MonitorRecovered", function(e) {
				if (e.srcDeviceId != that.deviceId) return;
				that.state = Station.MONITORED;
				that.sync();
			}, 0);
			// 订阅消息
			// 摘机事件
			event.on(stationOid + ".ServiceInitiated", function(e) {
				if (e.srcDeviceId != that.deviceId) return;
				// 摘机时一定不是激活的，不可以保持的
				that.calls.activeCall = "";
				that.calls.add({
					callId: e.callId,
					contactId: e.contactId,
					createTime: Date.now(),
					state: Call.OFFHOOK,
					direction: "Out",
					isHeld: false
				});
				logger.log("摘机");
				logger.log("activeCall - " + that.calls.activeCall);
				logger.log("calls - " + JSON.stringify(that.calls));
			}, 0);
			// 外拨事件
			event.on(stationOid + ".Originated", function(e) {
				if (e.srcDeviceId != that.deviceId) return;
				// 外拨时一定是激活的，外拨状态可以保持
				that.calls.activeCall = e.callId;
				that.calls.add({
					callId: e.callId,
					contactId: e.contactId,
					state: Call.DIALING,
					direction: "Out",
					ani: e.callingDevice,
					dnis: e.calledDevice
				});
				logger.log("外拨");
				logger.log("activeCall - " + that.calls.activeCall);
				logger.log("calls - " + JSON.stringify(that.calls));
			}, 0);
			// 振铃事件
			event.on(stationOid + ".Delivered", function(e) {
				if (e.srcDeviceId != that.deviceId) return;
				// 来电时一定不是激活的，振铃状态不可以保持
				if (e.alertingDevice == that.deviceId) {
					that.calls.add({
						callId: e.callId,
						contactId: e.contactId,
						createTime: Date.now(),
						ani: e.callingDevice,
						dnis: e.calledDevice,
						state: Call.RINGING,
						direction: "In",
						isHeld: false,
						queue: e.split
					});
					logger.log("RINGING - 振铃");
				} else {
					// 外拨
					that.calls.add({
						callId: e.callId,
						contactId: e.contactId,
						state: Call.DIALING,
						direction: "Out"
					});
					logger.log("Delivered - 到达");
				}
				logger.log("activeCall - " + that.calls.activeCall);
				logger.log("calls - " + JSON.stringify(that.calls));
			}, 0);
			// 接通事件
			event.on(stationOid + ".Established", function(e) {
				if (e.srcDeviceId != that.deviceId || e.srcDeviceId != e.answeringDevice && e.answeringDevice && e.answeringDevice != e.callingDevice && e.answeringDevice != e.calledDevice) return;
				var lastStateCall = that.calls.get(e.callId);
				// 之前存在，并且不是保持的
				if (!lastStateCall || !lastStateCall.isHeld) {
					that.calls.activeCall = e.callId;
				}
				that.calls.add({
					callId: e.callId,
					state: Call.CONNECTED,
					answerTime: Date.now()
				});
				logger.log("Established - 接通");
				logger.log("activeCall - " + that.calls.activeCall);
				logger.log("calls - " + JSON.stringify(that.calls));
			}, 0);
			// 挂断事件
			event.on(stationOid + ".ConnectionCleared", function(e) {
				if (e.srcDeviceId != that.deviceId) return;

				// 自己挂断
				if (that.deviceId == e.releasingDevice) {
					// 清除磋商标记
					if (e.releasingDevice == that.calls.consultationFrom || e.releasingDevice == that.calls.consultationTo) {
						that.calls.clearConsultation();
					}

					that.calls.remove(e.callId);
					if (e.callId == that.calls.activeCall) {
						that.calls.activeCall = "";
					}
				} else if ('Fail' == e.connectionState) {
					// 失败事件中没有callId
					//					that.calls.activeCall = "";
					//					that.calls.add({
					//						callId: e.callId,
					//						state: Call.FAILED,
					//						answerTime: Date.now()
					//					});
					//					if (e.callId == that.calls.activeCall) {
					//						that.calls.activeCall = "";
					//					}
				}
				logger.log("ConnectionCleared - 挂断");
				logger.log("activeCall - " + that.calls.activeCall);
				logger.log("calls - " + JSON.stringify(that.calls));
			}, 0);
			event.on(stationOid + ".Failed", function(e) {
				if (e.srcDeviceId != that.deviceId) return;
				//var offHookCall = that.calls.filter({
				//	state: Call.OFFHOOK
				//}).getLast();
				//if(offHookCall){
				//	offHookCall.state = Call.FAILED;
				//}
				logger.log("Failed - 呼叫失败");
				logger.log("activeCall - " + that.calls.activeCall);
				logger.log("calls - " + JSON.stringify(that.calls));
			}, 0);
			// 保持事件
			event.on(stationOid + ".Held", function(e) {
				if (e.srcDeviceId != that.deviceId) return;
				// 已激活的callId并且是保持方
				if (e.holdingDevice == that.deviceId) {
					that.calls.activeCall = "";
					that.calls.add({
						callId: e.callId,
						isHeld: true
					});
				}
				logger.log("Held - 保持");
				logger.log("activeCall - " + that.calls.activeCall);
				logger.log("calls - " + JSON.stringify(that.calls));
			}, 0);
			// 恢复事件
			event.on(stationOid + ".Retrieved", function(e) {
				if (e.srcDeviceId != that.deviceId) return;
				// 已保持的callId并且是恢复方
				if (e.retrievingDevice == that.deviceId) {
					that.calls.activeCall = e.callId;
					that.calls.add({
						callId: e.callId,
						isHeld: false
					});
					logger.log("Retrieved - 恢复");
					logger.log("activeCall - " + that.calls.activeCall);
					logger.log("calls - " + JSON.stringify(that.calls));
				}
			}, 0);
			// 会议事件
			event.on(stationOid + ".Conferenced", function(e) {
				if (e.srcDeviceId != that.deviceId) return;
				// 修正会议事件newCall
				// var state;
				// if((state =
				// that.calls.get(e.primaryOldCall))&&state.state
				// == 'dialing') e.callId =
				// e.newCall = e.primaryOldCall;
				// if((state =
				// that.calls.get(e.secondaryOldCall))&&state.state
				// == 'dialing') e.callId =
				// e.newCall =
				// e.secondaryOldCall;
				if (31 == e.cause || 1 == e.cause) {
					logger.info('单步会议');
					return;
				}
				if (e.primaryOldCall == that.calls.consultationFrom || e.secondaryOldCall == that.calls.consultationFrom || e.primaryOldCall == that.calls.consultationTo || e.secondaryOldCall == that.calls.consultationTo) {
					that.calls.clearConsultation();
				}
				// 自己是会议方
				if (e.conferencingDevice == that.deviceId) {
					// 移除旧的callId
					that.calls.remove(e.primaryOldCall != e.callId ? e.secondaryOldCall : e.primaryOldCall);
					//					// 更新新的call
					//					that.calls.add({
					//						callId: e.callId,
					//						isHeld: false
					//					});
					that.calls.replace(e.primaryOldCall != e.callId ? e.primaryOldCall : e.secondaryOldCall, {
						callId: e.callId,
						contactId: e.contactId,
						isHeld: false,
						state: Call.CONNECTED
					});
					that.calls.activeCall = e.callId;
				} else {
					// 更新旧的callId，旧的电话为激活则更新激活的电话
					that.calls.replace(e.primaryOldCall != e.callId ? e.primaryOldCall : e.secondaryOldCall, {
						callId: e.callId,
						contactId: e.contactId
					});
					if (that.calls.activeCall) {
						that.calls.activeCall = e.callId;
					}
				}
				logger.log("Conferenced - 会议");
				logger.log("activeCall - " + that.calls.activeCall);
				logger.log("calls - " + JSON.stringify(that.calls));
			}, 0);
			// 转移事件
			event.on(stationOid + ".Transferred", function(e) {
				if (e.srcDeviceId != that.deviceId) return;
				// 修正转移事件newCall
				// var state;
				// if((state =
				// that.calls.get(e.primaryOldCall))&&state.state
				// == 'dialing') e.callId =
				// e.newCall = e.primaryOldCall;
				// if((state =
				// that.calls.get(e.secondaryOldCall))&&state.state
				// == 'dialing') e.callId =
				// e.newCall =
				// e.secondaryOldCall;
				if (e.primaryOldCall == that.calls.consultationFrom || e.secondaryOldCall == that.calls.consultationFrom || e.primaryOldCall == that.calls.consultationTo || e.secondaryOldCall == that.calls.consultationTo) {
					that.calls.clearConsultation();
				}
				// 自己是转移方
				if (e.transferringDevice == that.deviceId) {
					that.calls.activeCall = "";
					that.calls.remove(e.primaryOldCall);
					that.calls.remove(e.secondaryOldCall);
				} else {
					// 更新旧的callId，旧的电话为激活则更新激活的电话
					that.calls.replace(e.primaryOldCall != e.newCall ? e.primaryOldCall : e.secondaryOldCall, {
						callId: e.callId,
						contactId: e.contactId
					});
					if (that.calls.activeCall) {
						that.calls.activeCall = e.callId;
					}
				}
				logger.log("Transferred - 转移");
				logger.log("activeCall - " + that.calls.activeCall);
				logger.log("calls - " + JSON.stringify(that.calls));
			}, 0);
			// 代接事件
			event.on(stationOid + ".Diverted", function(e) {
				if (e.srcDeviceId != that.deviceId) return;
				// 自己代接
				if (that.deviceId == e.divertingDevice) {
					// 清除磋商标记
					if (e.divertingDevice == that.calls.consultationFrom || e.divertingDevice == that.calls.consultationTo) {
						that.calls.clearConsultation();
					}

					that.calls.remove(e.callId);
					if (e.callId == that.calls.activeCall) {
						that.calls.activeCall = "";
					}
				}
				logger.log("Diverted - 代接");
				logger.log("activeCall - " + that.calls.activeCall);
				logger.log("calls - " + JSON.stringify(that.calls));
			}, 0);
			that.initialized = true;
		},
		/**
		 * 监视分机|坐席 会话未激活->拒绝 会话已激活 不是初始状态->完成 是初始状态->发送监控消息，初始化
		 *
		 * @param deviceId
		 *            设备号
		 * @returns
		 */
		monitor: function(id) {
			var that = this;
			logger.log("station - monitor:" + id);
			if (that.session.state != Session.ALIVE) {
				return Promise.reject(new Error(Error.SESSION_NOT_ALIVE));
			} else {
				if (!that.monitorMode) {
					return that.session.socket.send({
						method: "monitorDevice",
						object: "cti",
						params: [id]
					}).then(function(e) {
						that.state = Station.MONITORED;
						that.deviceId = id;
						that.init();
						that.session.stations.push(that);
					});
				} else {
					return that.session.socket.send({
						method: "monitorAgent",
						object: "cti",
						params: [id]
					}).then(function(e) {
						that.state = Station.MONITORED;
						that.agent.agentId = id;
						that.init();
						that.session.stations.push(that);
					});
				}
			}
		},
		sync: function(deviceId) {
			deviceId = deviceId || that.deviceId;
			logger.log("station - sync:" + deviceId);
			var that = this;
			if (that.session.state != Session.ALIVE) {
				return Promise.reject(new Error(Error.SESSION_NOT_ALIVE));
			}
			return that.session.query.queryStationByDeviceId(deviceId).then(function(device) {
				var agent = device.agent;
				if (agent) {
					that.agent.agentId = agent.agentId;
					that.agent.loginName = agent.loginName;
					that.agent.mode = agent.agentMode;
					that.agent.reason = agent.reason;
					// that.agent.autoWorkMode =
					// ;
					that.agent.reason = agent.reason;
					that.agent.queues = agent.queues || that.agent.queues;
				} else {
					that.agent.agentId = '';
					that.agent.loginName = '';
					that.agent.mode = Agent.LOGOUT;
					that.agent.curQueue = '';
					that.agent.reason = arr;
					that.agent.queues = arr;
				}
				that.calls.clear();
				for (var i = 0; i < device.calls.length; i++) {
					var state, isHeld, ani, dnis, contactId;
					switch (device.calls[i].state) {
					case "Initiate":
						state = Call.OFFHOOK;
						isHeld = false;
						break;

					case "Hold":
						state = Call.CONNECTED;
						isHeld = true;
						break;

					case "Connect":
						state = Call.CONNECTED;
						isHeld = false;
						if (device.call && device.call.callId == device.calls[i].callId) {
							that.calls.activeCall = device.calls[i].callId;
							ani = device.call.ani;
							dnis = device.call.dnis;
							contactId = device.call.contactId;
						}
						break;

					case "Alerting":
						state = Call.RINGING;
						isHeld = false;
						break;

					default:
						break;
					}
					var now = Date.now();
					that.calls.add({
						callId: device.calls[i].callId,
						createTime: now,
						answerTime: state == Call.RINGING ? now : undefined,
						deviceId: device.calls[i].deviceId,
						state: state,
						isHeld: isHeld,
						ani: ani,
						dnis: dnis,
						contactId: contactId
					});
				}
				that.deviceId = device.deviceId;
				that.session.event.trigger("StationStateChange", {
					source: that.deviceId
				});
			});
		},
		/**
		 * 停止监视分机 是初始状态->完成 不是初始状态 会话未激活->销毁 会话已激活 会话中有监视->销毁
		 * 会话已激活 会话中没有监视->发送停止监控消息，销毁
		 *
		 * @param deviceId
		 * @returns
		 */
		stopMonitor: function() {
			var that = this;
			logger.log("station - stopMonitor");
			// 从Session中移除
			var stations = that.session.stations;
			var index = stations.indexOf(that);
			if (index >= 0) {
				stations.splice(index, 1);
			}
			if (that.state == Station.PENDING) {
				that.destory();
				return Promise.resolve();
			} else {
				if (that.session.state != Session.ALIVE) {
					that.destory();
					return Promise.resolve();
				} else {
					var stations = that.session.stations;
					for (var i = 0; i < stations.length; i++) {
						if (stations[i] != that && stations[i].deviceId == deviceId && stations[i].state != Station.PENDING) {
							that.destory();
							return Promise.resolve();
						}
					}
					// that.state = Station.STOPPING;
					if (!that.monitorMode) {
						return that.session.socket.send({
							method: "stopMonitorDevice",
							object: "cti",
							params: [that.deviceId]
						}).then(function() {
							that.destory();
						})["catch"](function() {
							that.destory();
						});
					} else {
						return that.session.socket.send({
							method: "stopMonitorAgent",
							object: "cti",
							params: [that.agent.agentId]
						}).then(function() {
							that.destory();
						})["catch"](function() {
							that.destory();
						});
					}
				}
			}
		},
		/**
		 * 正确：分机未登录，坐席未登录，或者已登录，对应；错误：分机正在通话；分机被其他工号登录；坐席登录其他分机
		 *
		 * @param deviceId
		 *            可选
		 * @param agentId
		 *            必选
		 * @param password
		 *            必选
		 */
		signIn: function(deviceId, agentId, password, options) {
			logger.log("station - signIn - deviceId:" + deviceId + ", agentId:" + agentId + ", password:" + password);
			var that = this;
			options = options || support;
			if (that.session.state != Session.ALIVE) return Promise.reject(new Error(Error.SESSION_NOT_ALIVE));
			
			
			// 如果用reconnectSession连接的，并且是登陆的，不用登陆
			// 不是reconnectSession，即便是登陆的也要先退出再登陆
			return Promise.resolve().then(function(){
				var device = null;
				// 分机快照
				return that.session.query.queryStationByDeviceId(deviceId).then(function(e) {
					device = e;
					// 坐席快照
					return that.session.query.queryStationByAgentId(agentId);
				}).then(function(agent) {
					// 分机已登录
					if (device.agentMode != "Logout" && device.agent) {
						// 分机已登录并且登录工号不是自己
						if (device.agent.agentId != agentId) {
							return Promise.reject(new Error(Error.EXIST_DEVICE_LOGIN, {
								agentId: device.agent.agentId
							}));
						}
					}
					// 坐席已登录
					if (agent && agent.agentMode != "Logout") {
						// 坐席已登录并且登录分机不是自己
						if (agent.deviceId != deviceId) {
							return Promise.reject(new Error(Error.EXIST_AGENT_LOGIN, {
								deviceId: agent.deviceId
							}));
						}
						if (that.state == Station.PENDING) {
							// 查询坐席密码
							return that.session.query.queryAgentByLoginName(agent.agent.loginName).then(function(e) {
								if (e.password == password) {
									return;
								} else {
									return Promise.reject(new Error(Error.INVALID_PASSWORD, {
										type: "client"
									}));
								}
							}).then(function() {
								if(that.session.connectType == ConnectType.CONNECT){
									return that.setState(deviceId, agentId, "", Agent.LOGOUT, null).then(function(e) {
								
										return that.setState(deviceId, agentId, password, Agent.LOGIN, options);
									});
								} else {
									return;
								}
							});
						} else {
							return;
						}
					}
					// 分机正在通话
					if (device.calls.length) {
						return Promise.reject(new Error(Error.RESOURCE_BUSY, {
							type: "client"
						}));
					}
					return that.setState(deviceId, agentId, password, Agent.LOGIN, options);
				});
				
			}).then(function(){
				return that.monitor(deviceId);
			}).then(function(e) {
					// 绑定sessionId和坐席
				return that.initDesktop(deviceId, agentId);
			}).then(function(e) {
				// 自动工作模式
				return that.setAuto(agentId, options.autoWorkMode);
			}).then(function(e){
				// 等待1秒
				return new Promise(function(resolve, reject){
					window.setTimeout(function(){
						resolve(e);
					}, 500);
				});
			}).then(function(e) {
				// 同步状态
				return that.sync(deviceId);  
			}).then(function() {
				that.agent.agentId = agentId;
				that.agent.password = password;
				var agentMode = that.agent.mode;
				var loginEvent = {
					_sessionId: that.session.sessionId,
					agentId: agentId,
					agentMode: Agent.LOGIN,
					deviceId: deviceId,
					reason: options.reason,
					srcDeviceId: deviceId
				};
				that.session.event.trigger("AgentLoggedOn", loginEvent);
				that.session.event.trigger("AgentStateChange", loginEvent);
				var modeEvent = {
					_sessionId: that.session.sessionId,
					agentId: agentId,
					agentMode: agentMode,
					deviceId: deviceId,
					reason: options.reason,
					srcDeviceId: deviceId
				};
				var name = Station.MODE_EVENT_MAP[agentMode];
				if (name) {
					that.session.event.trigger(name, modeEvent);
				}
				that.session.event.trigger("AgentStateChange", modeEvent);
			}, function(e) {
				logger.warn("Login failure, stop monitor device, reason - " + e.message);
				// 停止监视分机
				return that.stopMonitor().then(function() {
					return Promise.reject(e);
				});
			});
		},
		/**
		 * 正确：分机已登录，坐席已登录，对应；分机未登录，坐席未登录;错误：分机被其他工号登录；坐席登录其他分机
		 *
		 * @param deviceId
		 * @param agentId
		 */
		signOut: function(options) {
			var that = this;
			options = options || support;
			var deviceId = options.deviceId || that.deviceId;
			var agentId = options.agentId || that.agent.agentId;
			logger.log("station - signOut, deviceId:" + deviceId + ", agentId:" + agentId);
			if (that.session.state != Session.ALIVE) {
				return Promise.reject(new Error(Error.SESSION_NOT_ALIVE));
			}
			if (!deviceId || !agentId && that.state != Station.MONITORED) {
				return Promise.reject(new Error(Error.STATION_NOT_MONITORED));
			}
			if (that.agent.mode == Agent.LOGOUT) {
				return Promise.reject(new Error(Error.NOT_LOGGED_IN));
			} else {
				var lastState = that.state;
				that.state = Station.STOPPING;
				return that.setState(deviceId, agentId, "", Agent.LOGOUT, options).then(function(e) {
					// 停止监视分机
					return new Promise(function(resolve, reject) {

						var fn = function(e) {
								that.stopMonitor().then(function(e) {
									resolve();
								}, function(e) {
									resolve();
								});
							}
						var origFn = fn;
						fn = function(e) {
							if (e.srcDeviceId == deviceId && 'Logout' == e.agentMode) {
								that.session.event.off("AgentStateChange", fn, 2);
								origFn.apply(fn, arguments);
							}
						};
						
						that.session.event.on("AgentStateChange", fn, 2);
					});
				}, function(e) {
					that.state = lastState;
					return Promise.reject(e);
				});
			}
		},
		/**
		 * 正确：分机已登录，坐席已登录，对应；错误：分机被其他工号登录；坐席登录其他分机；分机未登录;坐席未登录;
		 *
		 * @param mode
		 * @param options
		 */
		setMode: function(mode, options) {
			var that = this;
			options = options || support;
			var deviceId = options.deviceId || that.deviceId;
			var agentId = options.agentId || that.agent.agentId;
			logger.log("station - setMode, deviceId:" + deviceId + ", agentId:" + agentId);
			if (that.session.state != Session.ALIVE) return Promise.reject(new Error(Error.SESSION_NOT_ALIVE));
			if (!deviceId || !agentId && that.state != Station.MONITORED) {
				return Promise.reject(new Error(Error.STATION_NOT_MONITORED));
			}
			if (that.agent.mode == Agent.LOGOUT) {
				return Promise.reject(new Error(Error.NOT_LOGGED_IN));
			} else {
				return that.setState(deviceId, agentId, "", mode, options);
			}
		},
		setState: function(deviceId, agentId, password, mode, options) {
			logger.log("station - setState, deviceId:" + deviceId + ", agentId:" + agentId);
			var that = this;
			options = options || support;
			if (that.session.state != Session.ALIVE) return Promise.reject(new Error(Error.SESSION_NOT_ALIVE));
			if (!deviceId || !agentId && that.state != Station.MONITORED) {
				return Promise.reject(new Error(Error.STATION_NOT_MONITORED));
			}
			var func = "";
			var agentMode = "";
			// Logout Login WorkNotReady NotReady Ready
			// WorkNotReady
			switch (mode) {
			case Agent.LOGIN:
				func = Agent.LOGIN;
				agentMode = options.loginMode || that.loginMode || settings.loginMode;
				break;

			case Agent.LOGOUT:
				func = Agent.LOGOUT;
				agentMode = Agent.LOGOUT;
				break;

			case Agent.NOT_READY:
				func = "SetState";
				agentMode = Agent.NOT_READY;
				break;

			case Agent.READY:
				func = "SetState";
				agentMode = Agent.READY;
				break;

				// case Agent.WORK_READY:
				// func = 'SetState';
				// agentMode = Agent.WORK_READY;
				// break;
			case Agent.WORK_NOT_READY:
				func = "SetState";
				agentMode = Agent.WORK_NOT_READY;
				break;

			default:
				return Promise.reject(new Error("坐席模式无效"));
				break;
			}
			return that.session.socket.send({
				method: "setAgentState",
				object: "cti",
				params: [{
					deviceId: deviceId,
					agentId: agentId,
					password: password,
					agentMode: agentMode,
					func: func,
					group: options.group || "",
					reason: options.reason || "0"
				}]
			});
		},
		initDesktop: function(deviceId, agentId) {
			logger.log("station - initDesktop");
			var that = this;
			if (that.session.state != Session.ALIVE) return Promise.reject(new Error(Error.SESSION_NOT_ALIVE));
			return that.session.socket.send({
				method: "initDesktop",
				object: "cti",
				params: [agentId, deviceId]
			});
		},
		changePassword: function(agentId, oldPassword, newPassword) {
			logger.log("station - changePassword");
			var that = this;
			if (that.session.state != Session.ALIVE) return Promise.reject(new Error(Error.SESSION_NOT_ALIVE));
			return that.session.socket.send({
				method: "changePassword",
				object: "cti",
				params: [agentId, oldPassword, newPassword]
			});
		},
		setAuto: function(agentId, autoWorkMode) {
			logger.log("station - setAuto");
			var that = this;
			if (that.session.state != Session.ALIVE) return Promise.reject(new Error(Error.SESSION_NOT_ALIVE));
			autoWorkMode = autoWorkMode || that.agent.autoWorkMode || settings.autoWorkMode || "AutoIn";
			return that.session.socket.send({
				method: "setAgentAutoWorkMode",
				object: "cti",
				params: [{
					autoWorkMode: autoWorkMode,
					agentId: agentId
				}]
			});
		},
		dial: function(dest, options) {
			logger.log("station - dial");
			var that = this;
			options = options || support;
			if (that.session.state != Session.ALIVE) return Promise.reject(new Error(Error.SESSION_NOT_ALIVE));
			if (that.state != Station.MONITORED) return Promise.reject(new Error(Error.STATION_NOT_MONITORED));
			// 有电话并且不是摘机状态返回
			if (that.calls.length > 2 || that.calls.length == 1 && that.calls.getLast() && Call.OFFHOOK != that.calls.getLast().state) return Promise.reject(new Error(Error.INVALID_STATE_ERR));
			// 外拨
			return that.session.socket.send({
				method: "makeCall",
				object: "cti",
				params: [{
					dest: dest,
					deviceId: that.deviceId,
					origin: options.origin || that.deviceId
				}]
			});
		},
		answer: function() {
			logger.log("station - answer");
			var that = this;
			if (that.session.state != Session.ALIVE) return Promise.reject(new Error(Error.SESSION_NOT_ALIVE));
			if (that.state != Station.MONITORED) return Promise.reject(new Error(Error.STATION_NOT_MONITORED));
			// 振铃列表为空则返回
			var ringingCall = that.calls.filter({
				state: Call.RINGING
			}).getLast();
			if (!ringingCall) return Promise.reject(new Error(Error.INVALID_STATE_ERR));
			// 保存CallId，防止改变
			var ringingCallId = ringingCall.callId;
			// 已有激活的电话
			if (that.calls.activeCall) {
				// 先保持
				return that.hold().then(function(e) {
					that.session.socket.send({
						method: "answerCall",
						object: "cti",
						params: [{
							callId: ringingCallId,
							deviceId: that.deviceId
						}]
					});
				});
			} else {
				return that.session.socket.send({
					method: "answerCall",
					object: "cti",
					params: [{
						callId: ringingCallId,
						deviceId: that.deviceId
					}]
				});
			}
		},
		drop: function() {
			logger.log("station - drop");
			var that = this;
			if (that.session.state != Session.ALIVE) return Promise.reject(new Error(Error.SESSION_NOT_ALIVE));
			if (that.state != Station.MONITORED) return Promise.reject(new Error(Error.STATION_NOT_MONITORED));
			var heldCall = that.calls.filter({
				isHeld: true
			}).getLast(),
				initiatedCall = that.calls.filter({
					state: Call.OFFHOOK
				}).getLast();
			// 电话全是振铃状态则返回
			if (!that.calls.length || that.calls.filter({
				state: Call.RINGING
			}).length == that.calls.length) return Promise.reject(new Error(Error.INVALID_STATE_ERR));
			// 有激活的或摘机的先挂
			var activeCall = that.calls.get(that.calls.activeCall);
			if (activeCall || initiatedCall) {
				// 发送消息
				return that.session.socket.send({
					method: "clearConnection",
					object: "cti",
					params: [{
						callId: activeCall && activeCall.callId || initiatedCall && initiatedCall.callId,
						deviceId: that.deviceId
					}]
				});
			} else if (heldCall) {
				// 保存CallId，防止改变
				var callId = heldCall.callId;
				// 先恢复
				return that.retrieve().then(function() {
					// 发送消息
					return that.session.socket.send({
						method: "clearConnection",
						object: "cti",
						params: [{
							callId: callId,
							deviceId: that.deviceId
						}]
					});
				});
			}
		},
		hold: function() {
			logger.log("station - hold");
			var that = this;
			if (that.session.state != Session.ALIVE) return Promise.reject(new Error(Error.SESSION_NOT_ALIVE));
			if (that.state != Station.MONITORED) return Promise.reject(new Error(Error.STATION_NOT_MONITORED));
			// 没有已激活的电话
			var activeCall = that.calls.get(that.calls.activeCall);
			if (!activeCall) return Promise.reject(new Error(Error.INVALID_STATE_ERR));
			// 发送消息
			return that.session.socket.send({
				method: "holdCall",
				object: "cti",
				params: [{
					callId: activeCall.callId,
					deviceId: that.deviceId
				}]
			});
		},
		retrieve: function() {
			logger.log("station - retrieve");
			var that = this;
			// 有激活的电话重连
			// 有保持的电话恢复
			if (that.session.state != Session.ALIVE) return Promise.reject(new Error(Error.SESSION_NOT_ALIVE));
			if (that.state != Station.MONITORED) return Promise.reject(new Error(Error.STATION_NOT_MONITORED));
			// 无保持的则返回
			var heldCall = that.calls.filter({
				isHeld: true
			}).getLast(),
				initiatedCall = that.calls.filter({
					state: Call.OFFHOOK
				}).getLast();
			if (!heldCall) return Promise.reject(new Error(Error.INVALID_STATE_ERR));
			if (that.calls.activeCall) {
				return that.reconnect();
			} else {
				if (initiatedCall) {
					return that.session.socket.send({
						method: "clearConnection",
						object: "cti",
						params: [{
							callId: initiatedCall.callId,
							deviceId: that.deviceId
						}]
					}).then(function() {
						// 发送消息
						return that.session.socket.send({
							method: "retrieveCall",
							object: "cti",
							params: [{
								callId: heldCall.callId,
								deviceId: that.deviceId
							}]
						});
					});
				} else {
					// 发送消息
					return that.session.socket.send({
						method: "retrieveCall",
						object: "cti",
						params: [{
							callId: heldCall.callId,
							deviceId: that.deviceId
						}]
					});
				}
			}
		},
		reconnect: function() {
			logger.log("station - reconnect");
			var that = this;
			if (that.session.state != Session.ALIVE) return Promise.reject(new Error(Error.SESSION_NOT_ALIVE));
			if (that.state != Station.MONITORED) return Promise.reject(new Error(Error.STATION_NOT_MONITORED));
			var activeCall = that.calls.get(that.calls.activeCall);
			var heldCall = that.calls.filter({
				isHeld: true
			}).getLast();
			// 发送消息
			if (!activeCall || !heldCall) return Promise.reject(new Error(Error.INVALID_STATE_ERR));
			return that.session.socket.send({
				method: "reconnectCall",
				object: "cti",
				params: [{
					activeCallId: activeCall.callId,
					deviceId: that.deviceId,
					heldCallId: heldCall.callId
				}]
			});
		},
		consultation: function(dest, options) {
			logger.log("station - consultation");
			var that = this;
			options = options || support;
			if (that.session.state != Session.ALIVE) return Promise.reject(new Error(Error.SESSION_NOT_ALIVE));
			if (that.state != Station.MONITORED) return Promise.reject(new Error(Error.STATION_NOT_MONITORED));
			var activeCall = that.calls.get(that.calls.activeCall);
			var heldCall = that.calls.filter({
				isHeld: true
			}).getLast();
			if (!that.calls.length || activeCall && Call.CONNECTED != activeCall.state || !activeCall && !heldCall || heldCall && heldCall.state != Call.CONNECTED) return Promise.reject(new Error(Error.INVALID_STATE_ERR));
			// 没有已激活的或者已激活的不是通话状态 或者 没有保持的或者保持的不是通话状态 问题场景屏蔽
			var existingCall = activeCall || heldCall;
			// 发送消息
			return that.session.socket.send({
				method: "consultationCall",
				object: "cti",
				params: [{
					consultedDevice: dest,
					deviceId: that.deviceId,
					existingCall: existingCall.callId,
					userData: options.userData
				}]
			}).then(function(e) {
				that.calls.consultationFrom = existingCall.callId;
				that.calls.consultationTo = e.initiatedCall;
				that.calls.consultationType = options.type || "";
			});
		},
		conference: function(options) {
			logger.log("station - conference");
			var that = this;
			options = options || support;
			if (that.session.state != Session.ALIVE) return Promise.reject(new Error(Error.SESSION_NOT_ALIVE));
			if (that.state != Station.MONITORED) return Promise.reject(new Error(Error.STATION_NOT_MONITORED));
			// 没有保持的或激活的电话则返回
			// 已保持的电话必须处于通话状态
			var activeCall = that.calls.get(that.calls.activeCall);
			var heldCall = that.calls.filter({
				isHeld: true
			}).getLast();
			var consultationFrom = that.calls.get(that.calls.consultationFrom) || heldCall;
			// 修正磋商响应事件发生在振铃事件之后导致consultationTo为空的情形
			var consultationTo = that.calls.get(that.calls.consultationTo) || activeCall;

			that.calls.consultationType = that.calls.consultationType || '';
			var consultationType = options.type || '';
			// 如果没有激活的电话 或者磋商类型与会议类型不一致 或者磋商的电话不存在 或者磋商的电话不是保持状态
			// 或者 磋商的电话不是通话状态 则返回
			if (!activeCall || !consultationTo || activeCall.callId != consultationTo.callId || that.calls.consultationType != consultationType || !consultationFrom || !consultationFrom.isHeld || consultationFrom.state != Call.CONNECTED) return Promise.reject(new Error(Error.INVALID_STATE_ERR));
			// 发送消息
			return that.session.socket.send({
				method: "conferenceCall",
				object: "cti",
				params: [{
					activeCall: consultationTo.callId,
					deviceId: that.deviceId,
					heldCall: consultationFrom.callId
				}]
			});
		},
		transfer: function(options) {
			logger.log("station - transfer");
			var that = this;
			options = options || support;
			if (that.session.state != Session.ALIVE) return Promise.reject(new Error(Error.SESSION_NOT_ALIVE));
			if (that.state != Station.MONITORED) return Promise.reject(new Error(Error.STATION_NOT_MONITORED));
			var activeCall = that.calls.get(that.calls.activeCall);
			var heldCall = that.calls.filter({
				isHeld: true
			}).getLast();
			var consultationFrom = that.calls.get(that.calls.consultationFrom) || heldCall;
			var consultationTo = that.calls.get(that.calls.consultationTo) || activeCall;

			that.calls.consultationType = that.calls.consultationType || '';
			var consultationType = options.type || '';
			// 没有保持的或激活的电话或者保持的电话是外拨状态则返回
			if (!activeCall || !consultationTo || activeCall.callId != consultationTo.callId || that.calls.consultationType != consultationType || !consultationFrom || !consultationFrom.isHeld || consultationFrom.state != Call.CONNECTED) return Promise.reject(new Error(Error.INVALID_STATE_ERR));
			// 发送消息
			return that.session.socket.send({
				method: "transferCall",
				object: "cti",
				params: [{
					activeCall: consultationTo.callId,
					deviceId: that.deviceId,
					heldCall: consultationFrom.callId
				}]
			});
		},
		singleStepConference: function(dest, options) {
			logger.log("station - singleStepConference");
			var that = this;
			options = options || {};
			var type = options.type || "Active"; //Silent
			if (that.session.state != Session.ALIVE) return Promise.reject(new Error(Error.SESSION_NOT_ALIVE));
			
			// 反向加入
			if(options.reverse){
				var tmpStation = new Station(that.session);
				return tmpStation.sync(dest).then(function(e){
					var activeCall = tmpStation.calls.get(tmpStation.calls.activeCall)
					if(!activeCall) return Promise.reject(new Error(Error.INVALID_STATE_ERR));
					return that.session.socket.send({
						method: "singleStepConferenceCall",
						object: "cti",
						params: [{
							activeCall: activeCall.callId,
							deviceId: dest,
							deviceToJoin: that.deviceId,
							participationType: type
						}]
					});
				});
			}
			
			if (that.state != Station.MONITORED) return Promise.reject(new Error(Error.STATION_NOT_MONITORED));
			// 没有激活的电话或者激活的电话不是通话状态则返回
			var activeCall = that.calls.get(that.calls.activeCall);
			if (!activeCall || activeCall.state != Call.CONNECTED) return Promise.reject(new Error(Error.INVALID_STATE_ERR));
			// 发送消息
			return that.session.socket.send({
				method: "singleStepConferenceCall",
				object: "cti",
				params: [{
					activeCall: activeCall.callId,
					deviceId: that.deviceId,
					deviceToJoin: dest,
					participationType: type
				}]
			});
		},
		singleStepTransfer: function(dest, options) {
			logger.log("station - singleStepTransfer");
			var that = this;
			options = options || {};
			if (that.session.state != Session.ALIVE) return Promise.reject(new Error(Error.SESSION_NOT_ALIVE));
			if (that.state != Station.MONITORED) return Promise.reject(new Error(Error.STATION_NOT_MONITORED));
			// 没有激活的电话或者激活的电话不是通话状态则返回
			var activeCall = that.calls.get(that.calls.activeCall);
			if (!activeCall || activeCall.state != Call.CONNECTED) return Promise.reject(new Error(Error.INVALID_STATE_ERR));
			// 发送消息
			return that.session.socket.send({
				method: "singleStepTransferCall",
				object: "cti",
				params: [{
					activeCall: activeCall.callId,
					deviceId: that.deviceId,
					transferredTo: dest,
					userData: options.userData
				}]
			});
		},
		destory: function() {
			logger.log("station - destory");
			var that = this;
			if (that.initialized) {
				that.session.event.off("Station" + that.guid + ".*", 0);
				that.state = Station.PENDING;
				that.initialized = false;
			}
		}
	};
	/**
	 * 查询器
	 */
	var Query = function(session) {
			this.session = session;
		};
	Query.prototype = {
		constructor: Query,
		queryReasonCode: function() {
			logger.info("queryReasonCode");
			var that = this;
			return that.session.socket.send({
				method: "queryDictionary",
				object: "res",
				params: ["REASON_CODE"]
			});
		},
		queryStationByDeviceId: function(deviceId) {
			logger.info("queryStationByDeviceId:" + deviceId);
			var that = this;
			return that.session.socket.send({
				method: "snapshotDevice",
				object: "cti",
				params: [{
					deviceId: deviceId,
					func: 1,
					syncAtOnce: false
				}]
			}).then(function(e) {
				if (!(e || support).device) {
					return Promise.reject({
						name: "NO_DEVICE_INFO",
						message: "未获取到分机信息",
						code: "410",
						type: "client"
					});
				} else {
					return Promise.resolve((e || support).device);
				}
			});
		},
		queryStationByAgentId: function(agentId) {
			logger.info("queryStationByAgentId:" + agentId);
			var that = this;
			return that.session.socket.send({
				method: "snapshotDevice",
				object: "cti",
				params: [{
					agentId: agentId,
					func: 1,
					syncAtOnce: false
				}]
			}).then(function(e) {
				return Promise.resolve((e || support).device);
			});
		},
		queryAgentByLoginName: function(loginName) {
			logger.log("queryAgentByLoginName:" + loginName);
			var that = this;
			return that.session.socket.send({
				method: "queryAgentByLoginName",
				object: "res",
				params: [loginName]
			});
		},
		queryAllQueues: function(option) {
			logger.log("queryAllQueues!");
			var that = this;
			//{"method":"queryResources","object":"res","params":["Queue","RTStat"]}
			option = option || support;
			return that.session.socket.send({
				method: "queryResources",
				object: "res",
				params: ["Queue",option.realtimeStat || settings.realtimeStat]
			});
		},
		queryQueue: function(groupNo) {}
	};
	var Cache = {};
	var ConnectType = {
		CONNECT: 1,
		RECONNECT: 2
	};
	var Session = function() {
			this.guid = ++GUID;
			this.state = 0;
			this.sessionId = "";
			this.event = new Event();
			this.query = new Query(this);
			this.socket = new Socket(this);
			this.serverArgs = [];
			this.serverAddr = '';
			this.forcedClose = false;
			this.stations = [];
			this.startTime = 0;
			this.endTime = 0;
			this.reconnectAttempts = 0;
			this.heartbeatTimer = 0;
			this.initialized = false;
			this.reasons = [];
			this.connectType = ConnectType.CONNECT;
		};
	Session.DEAD = 0;
	Session.ALIVE = 1;
	Session.CONNECTING = 2;
	Session.CLOSING = 3;
	// Session.RECOVERING = 3;
	Session.prototype = {
		monitor: function(deviceId) {
			var that = this;
			that.socket.send({
				method: "monitorDevice",
				object: "cti",
				params: [deviceId]
			});
		},
		monitorAgent: function(agentId) {
			var that = this;
			that.socket.send({
				method: "monitorAgent",
				object: "cti",
				params: [agentId]
			});
		},
		stopMonitorAgent: function(agentId) {
			var that = this;
			that.socket.send({
				method: "stopMonitorAgent",
				object: "cti",
				params: [agentId]
			});
		},
		constructor: Session,
		init: function() {
			if (this.initialized) return;
			var that = this;
			var sessionOid = "session" + that.guid;
			// 订阅消息
			that.event.on(sessionOid + ".Disconnected", function() {
				that.state = Session.CONNECTING;
				window.clearTimeout(that.heartbeatTimer);
				console.log(that);
				that.reconnect();
			}, 0);
			that.event.on(sessionOid + ".Reconnected", function() {
				that.state = Session.ALIVE;
				// that.state = Session.RECOVERING;
				that.recover();
			}, 0);
			that.event.on(sessionOid + ".Recovered", function() {}, 0);
			that.startTime = Date.now();
			that.initialized = true;
		},
		parseDcmpAddr: function(dcmp, connector) {
			return $.format(settings.dcmpAddr, dcmp, connector || "DefaultConnector");
		},
		parseServerAddr: function(connector) {
			var protocol = window.location.protocol == 'https:' ? 'wss:' : 'ws:'
			return $.format(settings.serverAddr, {
				protocol:protocol,
				hostAndPort:connector
			});
		},
		testConnection: function(url) {
			logger.info('session - testConnection:' + url);
			return new Promise(function(resolve, reject) {
				var ws;
				var timeout = settings.timeout;
				var timer = setTimeout(function() {
					ws && ws.close();
					reject(new Error(Error.SERVER_CONNECTION_FAILED, {
						server: url
					}));
				}, timeout);
				if ("WebSocket" in window) {
					ws = new WebSocket(url);
				} else if ("MozWebSocket" in window) {
					ws = new MozWebSocket(url);
				} else {
					window.clearTimeout(timer);
					timer = 0;
					ws && ws.close();
					reject(new Error("not support WebSocket"));
					alert("not support WebSocket");
					return;
				}
				// 打开时触发
				ws.onopen = function(e) {
					logger.info("Test WebSocket opened");
					window.clearTimeout(timer);
					timer = 0;
					resolve(url);
					ws && ws.close();
				};
				// 关闭时触发
				ws.onclose = function(e) {
					logger.info("Test WebSocket closed");
					if (timer) {
						window.clearTimeout(timer);
						timer = 0;
						reject(new Error(Error.SERVER_CONNECTION_FAILED, {
							server: url
						}));
					}
				};
				// 错误时触发
				ws.onerror = function(e) {
					logger.warn("Test WebSocket error");
				};
			});
		},
		start: function(dcmp, connector, options) {
			logger.log("session - start");
			
			var LocalSessionID;
			
			var that = this;
			// 获得连接参数，初始连接时取此函数的参数，重连的时候取保存的参数
			var args = that.serverArgs = (arguments.length && arguments) || that.serverArgs || arr;
			// 获得扩展参数
			var options = args.length > 1 && (typeof args[args.length - 1] == 'object') && args[args.length - 1] || support;

			return Promise.resolve().then(function() {
				// 连接DCMP
				if (typeof args[0] == 'string' && typeof args[1] == 'string') {
					var dcmpAddr = that.parseDcmpAddr(args[0], args[1]);  
					return that.getServerAddr(dcmpAddr, options);
				// 连接IP地址
				} else if (Array.isArray(args[0]) && args[0].length > 0) {
					var raceValues = [];
					connectors.forEach(function(e){
						var url = that.parseServerAddr(e);
						raceValues.push(that.testConnection(url));
					});
					return Promise.race(raceValues);
				} else {
					return Promise.reject(new Error(Error.SERVER_CONNECTION_FAILED, {
						server: JSON.stringify(args)
					}));
				}
			}).then(function(e) {
				return that.socket.open(e, options);
			}).then(function(e) {

				// 只允许一次session是才能这样做
				// 第一次连接时   reconnectAttempts = 0
				// 连接时检测sessionId，
				// 1、sessionId存在且没过期，直接调用reconnectSession->如果失败调用正常逻辑
				// 2、正常连接initSession
				if (localStorage.getItem(LocalSessionID)){//判断本地是否存有sessionId
					var val = localStorage.getItem(LocalSessionID);//获取存储的元素
					var dataobj = JSON.parse(val);//解析出json对象
					if (that.reconnectAttempts == 0 && !settings.multipleSession){
					
						if( Date.now() - dataobj.time > settings.heartbeatInterval )//如果当前时间-减去存储的元素在创建时候设置的时间 > 过期时间
						{
							console.log("sessionId " + dataobj.val + " is expires");//提示过期
							return that.initSession();
						} else{
							console.log("sessionId = " + dataobj.val);
							return that.reconnectSession(dataobj.val)
							["catch"](function() {
								return that.initSession();
							});
						}
					}
				// 重连时   
				
				// 第一次重连的时候(reconnectAttempts = 1)，取session里保存的sessionId,先调用reconnectSession
				// 失败就调用start  
				// 不是第一次，直接调用start
				// 每一分钟更新一次session， 更新到本地
					else if (that.reconnectAttempts == 1 && !settings.multipleSession){
						return that.reconnectSession(dataobj.val)
						["catch"](function() {
							return that.initSession();
						});
					}else{
						return that.initSession();
					}
				}else {
						return that.initSession();
				}
				
				// 如果用reconnectSession连接的，并且是登陆的，不用登陆
				// 不是reconnectSession，即便是登陆的也要先退出再登陆
				
				// 加上每分钟更新sessionId和时间
				
			}).then(function(e) {
				that.sessionId = e.sessionId;
				that.init();
				that.state = Session.ALIVE;
				// 开始会话后发送心跳
				that.ping();
			}, function(e) {
				that.socket.close();
				return Promise.reject(e);
			}).then(function(e) {
				return that.query.queryReasonCode().then(function(e) {
					that.reasons = e;
				})['catch'](noop);
			});
		},
		ping: function() {
			var that = this;
			var localSessionID;
			that.setLocalSessionId(localSessionID,that.sessionId);
			
			that.heartbeatTimer = window.setTimeout(function() {
				if (that.state == Session.ALIVE) {
					logger.log("session - ping");
					that.socket.send({
						method: "heartbeat",
						object: "cti",
						params: null
					}).then(function(e) {
						logger.info("session - pong");
					})["catch"](function(e) {
						logger.error(e.message);
					});
					that.ping();
				}
			}, that.heartbeatInterval || settings.heartbeatInterval);
		},
		// 本地存储sessionID
		setLocalSessionId: function(key,value){
			logger.log("update local session " + value);
			var curtime = new Date().getTime();//获取当前时间
			localStorage.setItem(key,JSON.stringify({val:value,time:curtime}));
		},
		initSession: function(){
			logger.log('initSession - end');
			var that = this;
			return that.socket.send({
				method: "initSession",
				object: "cti",
				params: ["", navigator.userAgent + ";" + new Date().toUTCString(), "", "Async"]
			}).then(function(e){
				that.connectType = ConnectType.CONNECT;
				return e;
			});
		},
		reconnectSession: function(sessionId){
			logger.log('reconnectSession - ' + sessionId);
			var that = this;
			return that.socket.send({
				method: "reconnectSession",
				object: "cti",
				params: [sessionId,""]
			}).then(function(e){
				that.connectType = ConnectType.RECONNECT;
				return e;
			});
		},
		end: function() {
			logger.log("session - end");
			var LocalSessionID;
			var that = this;
			that.socket.forcedClose = true;
			if (that.state != Session.ALIVE) {
				return Promise.resolve();
			}
			for (var i = 0; i < that.stations.length; i++) {
				var station = that.stations[i];
				if (station.state != Station.PENDING) {
					station.stopMonitor();
				}
			}
			//退出时，清除存在本地的sessionID
			localStorage.removeItem(LocalSessionID);
			
			that.state = Session.DEAD;
			// that.state = Session.CLOSING;
			return that.socket.send({
				method: "close",
				object: "cti",
				params: null
			}).then(function() {
				that.destory();
				that.socket.close();
			})["catch"](function() {
				that.destory();
				that.socket.close();
			});
		},
		reconnect: function() {
			logger.log("session - reconnect");
			var that = this;
			var reconnectInterval = that.reconnectInterval || settings.reconnectInterval;
			var reconnectDecay = that.reconnectDecay || settings.reconnectDecay;
			var maxReconnectAttempts = that.maxReconnectAttempts || settings.maxReconnectAttempts;
			var maxReconnectInterval = that.maxReconnectInterval || settings.maxReconnectInterval;
			var timeout = reconnectInterval * Math.pow(reconnectDecay, that.reconnectAttempts);
			setTimeout(function() {
				if (that.socket.forcedClose || maxReconnectAttempts && that.reconnectAttempts > maxReconnectAttempts) {
					that.reconnectAttempts == 0;
					return;
				}
				that.reconnectAttempts++;
				that.event.trigger("Connecting", {
					reconnectAttempts: that.reconnectAttempts
				});
				that.start().then(function() {
					that.reconnectAttempts = 0;
					that.event.trigger("Reconnected");
				}, function(e) {
					that.socket.forcedClose = false;
					that.reconnect();
				});
			}, timeout > maxReconnectInterval ? maxReconnectInterval : timeout);
		},
		recover: function() {
			logger.log("session - recover");
			var that = this;
			var errors = [];
			var promise = Promise.resolve();
			var count1 = 0;
			var count2 = 0;
			for (var i = 0, len = that.stations.length; i < len; i++) {
				var station = that.stations[i];
				if (station.state != Station.PENDING) {
					station.state = Station.RECOVERING;
					(function() {
						count1++;
						var localStation = station;
						if (station.agent && station.agent.mode != Agent.PENDING && station.agent.mode != Agent.LOGOUT) {
							promise = promise.then(function(e) {
								return localStation.signIn(localStation.deviceId, localStation.agent.agentId, localStation.agent.password).then(function(e) {
									count2++;
									if (count1 === count2) {
										that.event.trigger("Recovered", errors);
									}
								}, function(e) {
									count2++;
									errors.push(e);
									if (count1 === count2) {
										that.event.trigger("Recovered", errors);
									}
								});
							});
						} else {
							promise = promise.then(function(e) {
								return localStation.monitor(localStation.deviceId).then(function(e) {
									count2++;
									if (count1 === count2) {
										that.event.trigger("Recovered", errors);
									}
								}, function(e) {
									count2++;
									errors.push(e);
									if (count1 === count2) {
										that.event.trigger("Recovered", errors);
									}
								});
							});
						}
					})();
				}
			}
			if (count1 == 0) {
				that.event.trigger("Recovered", errors);
			}
		},
		getServerAddr: function(dcmpAddr, options) {
			logger.log("session - getServerAddr[" + dcmpAddr + "]");
			var that = this;
			return $.ajax(dcmpAddr, options).then(function(e) {
				try {
					that.currentServer = JSON.parse(e.responseText).serviceLocation;
					var serverAddr = that.parseServerAddr(that.currentServer);
					return serverAddr;
				} catch (e) {
					return Promise.reject(new Error(Error.NO_AVAILABLE_SERVER));
				}
			});
		},
		destory: function() {
			logger.log("session - destory");
			var that = this;
			window.clearTimeout(that.heartbeatTimer);
			that.endTime = Date.now();
			if (that.initialized) {
				that.event.off("Session" + that.guid + ".*", 0);
				that.stations = [];
				that.state = Session.DEAD;
				that.initialized = false;
			}
		}
	};
	$.logger = logger;
	$.settings = settings;
	$.Error = Error;
	$.Event = Event;
	$.Socket = Socket;
	$.Call = Call;
	$.Calls = Calls;
	$.Query = Query;
	$.Agent = Agent;
	$.Station = Station;
	$.Group = Group;
	$.Session = Session;
	$.VERSION = version;
	return $;
});