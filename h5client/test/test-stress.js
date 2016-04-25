Number.prototype.toPercent = function() {
	return (Math.round(this * 10000) / 100).toFixed(2) + '%';
}
var widget = {
	progress : (function(success, warn, error) {
		var $progress = $('#progress');
		var $progressSuccess = $('#progressSuccess');
		var $progressWarn = $('#progressWarn');
		var $progressError = $('#progressError');
		var total = 0;
		var successNum = 0;
		var warnNum = 0;
		var errorNum = 0;

		var running = false;

		return {
			total : function(num) {
				total = num;
				return this;
			},
			onStart : function(total) {
			},
			onStop : function(total, successNum, warnNum, errorNum) {
			},
			start : function() {
				if (running)
					return this;
				return this.open();
			},
			open : function() {
				successNum = 0;
				warnNum = 0;
				errorNum = 0;
				running = true;
				$progress.removeClass('hide');
				$progressSuccess.css('width', '0%');
				$progressWarn.css('width', '0%');
				$progressError.css('width', '0%');

				if (this.onStart) {
					this.onStart(total);
				}
				return this;
			},
			stop : function() {
				if (successNum + warnNum + errorNum < total)
					return this;
				return this.close();
			},
			close : function() {
				if (this.onStop) {
					this.onStop(total, successNum, warnNum, errorNum);
				}
				setTimeout(function() {
					$progress.addClass('hide');
					$progressSuccess.css('width', '0%');
					$progressWarn.css('width', '0%');
					$progressError.css('width', '0%');
				}, 1000);

				successNum = 0;
				warnNum = 0;
				errorNum = 0;
				running = false;
				return this;
			},
			addSuccess : function() {
				this.start();
				$progressSuccess.css('width', (++successNum / total)
						.toPercent());
				this.stop();
				return this;
			},
			addWarn : function() {
				this.start();
				$progressWarn.css('width', (++warnNum / total).toPercent());
				this.stop();
				return this;
			},
			addError : function() {
				this.start();
				$progressError.css('width', (++errorNum / total).toPercent());
				this.stop();
				return this;
			}
		}
	})(),
	alert : function(text) {
		$('#alertTitle').html('信息!');
		$('#alertContent').html(text);
		var $alert = $('#alert');
		$alert
				.removeClass('hide alert-info alert-success alert-warning alert-danger');
		$alert.addClass('alert-info');
	},
	success : function(text) {
		$('#alertTitle').html('成功!');
		$('#alertContent').html(text);
		var $alert = $('#alert');
		$alert
				.removeClass('hide alert-info alert-success alert-warning alert-danger');
		$alert.addClass('alert-success');
	},
	warn : function(text) {
		$('#alertTitle').html('警告!');
		$('#alertContent').html(text);
		var $alert = $('#alert');
		$alert
				.removeClass('hide alert-info alert-success alert-warning alert-danger');
		$alert.addClass('alert-warning');
	},
	error : function(text) {
		$('#alertTitle').html('错误!');
		$('#alertContent').html(text);
		var $alert = $('#alert');
		$alert
				.removeClass('hide alert-info alert-success alert-warning alert-danger');
		$alert.addClass('alert-danger');
	}
};
var startTime;
widget.progress.onStart = function(total) {
	$('.btn').attr('disabled', "disabled");
	startTime = Date.now();
}
widget.progress.onStop = function(total, successNum, warnNum, errorNum) {
	$('.btn').removeAttr('disabled');
	var len = Date.now() - startTime;
	startTime = 0;
	var text = '成功：' + successNum + '，警告：' + warnNum + '，失败：' + errorNum
			+ '，时间：' + len + 'ms。';
	if (total == successNum) {
		widget.success(text);
	} else if (warnNum || errorNum && errorNum < total) {
		widget.warn(text);
	} else if (total == errorNum) {
		widget.error(text);
	}
};

var successCase = 0;
var failureCase = 0;
var totalTime = 0;
function testSuccess(time){
	successCase++;
	totalTime += time;
	widget.success('本次请求成功，总成功数：' + successCase + "，总失败数：" + failureCase + "，平均时间：" + Math.floor(totalTime/(successCase+failureCase)) + " ms");
}
function testFailure(time){
	failureCase++;
	totalTime += time;
	widget.error('本次请求失败，总成功数：' + successCase + "，总失败数：" + failureCase + "，平均时间：" + Math.floor(totalTime/(successCase+failureCase)) + " ms");
}
// setInterval(function() {
// widget.progress.addSuccess();
// widget.progress.addSuccess();
// widget.progress.addError();
// widget.progress.addSuccess();
// widget.progress.addWarn();
// }, 2000)
var Error = H5Client.Error;
// 自定义错误消息，可覆盖
Error.GENERIC_OPERATION = {
	code : 498,
	// 自定义未使用的错误号
	name : 'GENERIC_OPERATION',
	// 异常名称等于错误属性名称
	message : '操作失败，可能分机已被登录，或者分机号码未被注册（ONE-X或实体话机）',
	// 自定义错误消息
	type : 'user' // 自定义错误类型
};
Error.INVALID_STATE_ERR = {
	code : 407,
	name : "INVALID_STATE_ERR",
	message : "状态错误",
	type : "client"
};

// 修改全局配置
H5Client.settings.logAddr = logAddr;
H5Client.settings.timeout = timeout;
H5Client.settings.heartbeatInterval = heartbeatInterval;
H5Client.settings.loginMode = loginMode;
H5Client.settings.autoWorkMode = autoWorkMode;
H5Client.settings.debug = debug;

H5Client.logger.open();

var Session = H5Client.Session;
var Station = H5Client.Station;
var Agent = H5Client.Agent;
var Call = H5Client.Call;

var sessionContext = [];

$('#stop').hide();

$('#start').on('click', function() {
	startApp();
});
$('#stop').on('click', function() {
	stopApp();
});
$('#login').on('click', function() {
	widget.progress.open();
});
function validate() {

}
function startApp() {
	var stationsRangeStart = $('#stationsRangeStart').val();
	var agentsRangeStart = $('#agentsRangeStart').val();
	var destsRangeStart = $('#destsRangeStart').val();
	var deviceNumber = $('#deviceNumber').val();
	var password = $('#password').val();

	if (!stationsRangeStart) {
		widget.error("分机起始号码不能为空");
		return;
	}
	if (isNaN(stationsRangeStart = Number(stationsRangeStart))) {
		widget.error("分机起始号码非法");
		return;
	}
	if (!agentsRangeStart) {
		widget.error("工号起始号码不能为空");
		return;
	}
	if (isNaN(agentsRangeStart = Number(agentsRangeStart))) {
		widget.error("工号起始号码非法");
		return;
	}
	if (!destsRangeStart) {
		widget.error("目标起始号码不能为空");
		return;
	}
	if (isNaN(destsRangeStart = Number(destsRangeStart))) {
		widget.error("目标起始号码非法");
		return;
	}
	if (!password) {
		widget.error("密码不能为空");
		return;
	}
	if (!deviceNumber) {
		widget.error("数量不能为空");
		return;
	}
	if (isNaN(deviceNumber = Number(deviceNumber))) {
		widget.error("数量非法");
		return;
	}
	var deviceId = stationsRangeStart, agentId = agentsRangeStart, dest = destsRangeStart;
	sessionContext = [];
	successCase = 0;
	failureCase = 0;
	totalTime = 0;
	widget.progress.total(deviceNumber).open();
	while (deviceId < stationsRangeStart + deviceNumber) {
		sessionContext.push(startSession(deviceId, $('#virtualAgent').is(':checked') ? virtualAgentPrefix + agentId : agentId, password, dest));
		deviceId++;
		agentId++;
		dest++;
	}
	widget.alert("Session数量：" + sessionContext.length);
	$('.need-session').removeClass('hide');
	$('#start').hide();
	$('#stop').show();
}
function stopApp() {
	$('.need-session').addClass('hide');
	$('#login').off('click');
	$('#logout').off('click');
	$('#ready').off('click');
	$('#notReady').off('click');
	$('#workNotReady').off('click');
	$('#makeCall').off('click');
	$('#answerCall').off('click');
	$('#releaseCall').off('click');
	$('#holdCall').off('click');
	$('#retrieveCall').off('click');
	$('#initiateConference').off('click');
	$('#initiateTransfer').off('click');
	$('#consultation').off('click');
	$('#completeConference').off('click');
	$('#completeTransfer').off('click');
	$('#randomSetAgentState').off('click');
	$('#autoMakeCall').off('click');
	$('#autoAnswerCall').off('click');
	for (var i = 0; i < sessionContext.length; i++) {
		sessionContext[i].session.end();
	}
	sessionContext = [];
	widget.alert('测试结束');
	$('#stop').hide();
	$('#start').show();
}
function randomTimeout(callback){
	var num = Math.floor(Math.random()*10);
	
	return setTimeout(callback, num);
}
function startSession(deviceId, agentId, password, dest) {
	// 获得会话对象
	var session = new Session();
	// 获得事件对象
	var event = session.event;
	// 获得分机对象
	var station = new Station(session);
	var agent = station.agent;

	// 退出或刷新时关闭session
	window.onbeforeunload = function() {
		if (Session.ALIVE == session.state) {
			session.end();
		}
	}
	session.start(dcmpAddr, connector).then(function(e) {
		widget.progress.addSuccess();
	})['catch'](function(e) {
		widget.progress.addError();
	})
	// 监听坐席状态改变事件
	event.on('user.AgentStateChange', function(e) {
		if (e.agentId != agent.agentId)
			return;
	});
	event.on('user.Disconnected', function() {
		widget.alert('连接断开!');
	});
	event.on('user.Connecting', function(e) {
		widget.alert('正在重连(' + e.reconnectAttempts + ')...');
	});
	event.on('user.Reconnected', function(e) {
		widget.alert('重连成功，正在恢复数据...');
	});
	event.on('user.Recovered', function(e) {
		if (e.length) {
			widget.alert('恢复出现异常');
		} else {
			widget.alert('恢复成功');
		}
	});
	$('#randomSetAgentState').on('click', function(){
		var intervalTimer = 0;
		var timeoutTimer = 0;
		if ($('#randomSetAgentState').is(':checked')) {
			intervalTimer = setInterval(function(){
				var num = Math.floor(Math.random()*10);
				timeoutTimer = setTimeout(function(){
					var time = Date.now();
					if(agent.mode == Agent.NOT_READY && num < 9){
						station.setMode(Agent.READY).then(function(e) {
							testSuccess(Date.now() - time);
						})['catch'](function(e) {
							testFailure(Date.now() - time);
							station.sync(deviceId);
						});
					}else if(agent.mode == Agent.READY){
						station.setMode(Agent.NOT_READY).then(function(e) {
							testSuccess(Date.now() - time);
						})['catch'](function(e) {
							testFailure(Date.now() - time);
							station.sync(deviceId);
						});
					}else if(agent.mode == Agent.PENDING || agent.mode == Agent.LOGOUT){
						station.signIn(deviceId, agentId, password).then(function(e) {
							testSuccess(Date.now() - time);
						})['catch'](function(e) {
							testFailure(Date.now() - time);
							station.sync(deviceId);
						});
					}else{
						station.signOut().then(function(e) {
							testSuccess(Date.now() - time);
						})['catch'](function(e) {
							testFailure(Date.now() - time);
							station.sync(deviceId);
						});
					}
				}, num * 1000);
			}, 12000);
		}else{
			window.clearInterval(intervalTimer);
			window.clearTimeout(timeoutTimer);
		}
	});
	$('#autoMakeCall').on('click', function() {
		var intervalTimer = 0;
		var timeoutTimer = 0;
		var dropTimer = 0;
		if ($('#autoMakeCall').is(':checked')) {
			interval3Timer = setInterval(function(){
				var num = Math.floor(Math.random()*10);
				timeoutTimer = setTimeout(function(){
					if(!station.calls.size()){
						var time = Date.now();
						station.dial(dest).then(function(e) {
							testSuccess(Date.now() - time);
							dropTimer = setTimeout(function(){
								if(station.calls.size()){
									var time = Date.now();
									station.drop().then(function(e) {
										testSuccess(Date.now() - time);
									})['catch'](function(e) {
										testFailure(Date.now() - time);
									});
								}
							}, 10000);
						})['catch'](function(e) {
							testFailure(Date.now() - time);
						});
					}
				}, num * 1000);
			}, 30000);
		}else{
			window.clearInterval(intervalTimer);
			window.clearTimeout(timeoutTimer);
		}
	});

	$('#autoAnswerCall').on('click', function() {
		if ($('#autoAnswerCall').is(':checked')) {
			event.on('stress.Delivered', function(e){
				if (e.srcDeviceId != station.deviceId) return;
				// 来电
				if(e.alertingDevice == station.deviceId){
					var time = Date.now();
					station.answer().then(function(e) {
						testSuccess(Date.now() - time);
					})['catch'](function(e) {
						testFailure(Date.now() - time);
					});
				}
			});
		}else{
			event.off('stress.Delivered');
		}
	});

	$('#makeCall').on('click', function() {
		station.dial(dest).then(function(e) {
			widget.progress.addSuccess();
		})['catch'](function(e) {
			widget.progress.addError();
		});
	});

	$('#releaseCall').on('click', function() {
		station.drop().then(function(e) {
			widget.progress.addSuccess();
		})['catch'](function(e) {
			widget.progress.addError();
		});
	});
	
	$('#answerCall').on('click', function() {
		station.answer().then(function(e) {
			widget.progress.addSuccess();
		})['catch'](function(e) {
			widget.progress.addError();
		});
	});
	$('#holdCall').on('click', function() {
		station.hold().then(function(e) {
			widget.progress.addSuccess();
		})['catch'](function(e) {
			widget.progress.addError();
		});

	});
	$('#retrieveCall').on('click', function() {
		station.retrieve().then(function(e) {
			widget.progress.addSuccess();
		})['catch'](function(e) {
			widget.progress.addError();
		});
	});

	$('#login').on('click', function() {
		station.signIn(deviceId, agentId, password).then(function(e) {
			widget.progress.addSuccess();
		})['catch'](function(e) {
			widget.progress.addError();
		});
	});

	$('#ready').click(function() {
		station.setMode(Agent.READY).then(function(e) {
			widget.progress.addSuccess();
		})['catch'](function(e) {
			widget.progress.addError();
		});
	});

	$('#notReady').click(function() {
		station.setMode(Agent.NOT_READY).then(function(e) {
			widget.progress.addSuccess();
		})['catch'](function(e) {
			widget.progress.addError();
		});
	});
	$('#workNotReady').click(function() {
		station.setMode(Agent.WORK_NOT_READY).then(function(e) {
			widget.progress.addSuccess();
		})['catch'](function(e) {
			widget.progress.addError();
		});
	});
	$('#logout').click(function() {
		$('#statePanel').hide();
		station.signOut().then(function(e) {
			widget.progress.addSuccess();
		})['catch'](function(e) {
			widget.progress.addError();
		});
	});
	// userData: {
	// map:{
	// agentid:agent.agentId,
	// 'function':'playAgentNO'
	// }
	// }
	$('#consultation').on('click', function() {
		station.consultation(dest, {
			type : 'consultation'
		}).then(function(e) {
			widget.progress.addSuccess();
		})['catch'](function(e) {
			widget.progress.addError();
		});
	});
	$('#initiateConference').on('click', function() {
		station.consultation(dest, {
			type : 'conference'
		}).then(function(e) {
			widget.progress.addSuccess();
		})['catch'](function(e) {
			widget.progress.addError();
		});
	});
	$('#initiateTransfer').on('click', function() {
		station.consultation(dest, {
			type : 'transfer'
		}).then(function(e) {
			widget.progress.addSuccess();
		})['catch'](function(e) {
			widget.progress.addError();
		});
	});
	// 完成会议
	$('#completeConference').on('click', function() {
		station.conference({
			type : 'conference',
		}).then(function(e) {
			widget.progress.addSuccess();
		})['catch'](function(e) {
			widget.progress.addError();
		});
	});
	// 完成转移
	$('#completeTransfer').on('click', function() {
		station.transfer({
			type : 'transfer',
		}).then(function(e) {
			widget.progress.addSuccess();
		})['catch'](function(e) {
			widget.progress.addError();
		});
	});
	/*
	// 单转
	$('#singleStepTransfer').on('click', function() {
		station.singleStepTransfer($('#dest').val()).then(function(e) {
			widget.progress.addSuccess();
		})['catch'](function(e) {
			widget.progress.addError();
		});
	});
	// 满意度
	$('#satisfaction').on('click', function() {
		var activeCall = station.calls.get(station.calls.activeCall);
		station.singleStepTransfer(satisfaction, {
			// 随路数据
			userData : {
				map : {
					v : satisfaction,
					// transfer: "3"
					i : agent.agentId,
					u : activeCall.contactId,
					a : activeCall.ani,
					d : activeCall.dnis
				}
			}
		}).then(function(e) {
			console.info('满意度');

		})['catch'](function(e) {
			checkButton();
			widget.error(e.message);
		});
	});
	$('#sync').on('click', function() {
		Promise.resolve().then(function() {
			if (session.state == Session.DEAD) {
				return session.start(dcmpAddr, connector);
			}
		}).then(function(e) {
			if (station.state == Station.PENDING) {
				return station.monitor($('#deviceId').val());
			}
		}).then(function(e) {
			return station.sync($('#deviceId').val());
		}).then(function() {
			checkButton();
			console.info('同步');
			widget.alert('同步成功');
		})['catch'](function(e) {
			checkButton();
			widget.error(e.message);
		});
	});
	*/
	return {
		session : session,
		station : station,
		agent : agent,
		event : event
	};
}