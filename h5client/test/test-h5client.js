$(document).ready(function() {
	var widget = CCWidget();
	init();

	$(window).resize();

	var Error = H5Client.Error;
	// 自定义错误消息，可覆盖
	Error.GENERIC_OPERATION = {
		code: 498,
		// 自定义未使用的错误号
		name: 'GENERIC_OPERATION',
		// 异常名称等于错误属性名称
		message: '操作失败，可能分机已被登录，或者分机号码未被注册（ONE-X或实体话机）',
		// 自定义错误消息
		type: 'user' // 自定义错误类型
	};
	Error.INVALID_STATE_ERR = {
		code: 407,
		name: "INVALID_STATE_ERR",
		message: "状态错误",
		type: "client"
	};
	// 修改全局配置
	H5Client.settings.timeout = timeout;
	H5Client.settings.heartbeatInterval = heartbeatInterval;
	H5Client.settings.loginMode = loginMode;
	H5Client.settings.autoWorkMode = autoWorkMode;
	H5Client.settings.debug = debug;
	H5Client.settings.realtimeStat = realtimeStat;

	H5Client.settings.logAddr = logAddr;
	H5Client.logger.open();
	// 获得会话对象
	var Session = H5Client.Session;
	var session = new Session();

	// 获得事件对象
	var event = session.event;
	// 获得分机对象
	var Station = H5Client.Station;
	var station = new Station(session);
	var agent = station.agent;

	var Group = H5Client.Group;
	var group = new Group(session);

	var Agent = H5Client.Agent;
	var Call = H5Client.Call;
	var Query = new H5Client.Query(session);

	checkButton();

	// 退出或刷新时关闭session
	window.onbeforeunload = function() {
		if (Session.ALIVE == session.state) {
//			session.end();
		}
	}

	// 计算状态时长
	var calcDuration = (function() {
		console.info('calcDuration');
		var calcTimer = 0;
		var lastTime = 0;

		function fn() {
			var diff = H5Client.dateDiff(lastTime);
			var duration = (diff.D && (diff.D + '&nbsp;')) || '';
			duration += (diff.H && (diff.H < 10 ? ('0' + diff.H) : diff.H) + ':') || '';
			duration += ((diff.M < 10 ? ('0' + diff.M) : diff.M) + ':');
			duration += ((diff.S < 10 ? ('0' + diff.S) : diff.S));
			$('#duration').html(duration);
		};
		return {
			start: function() {
				lastTime = Date.now();
				fn();
				calcTimer = window.setInterval(fn, 1000);
			},
			stop: function() {
				window.clearInterval(calcTimer);
				calcTimer = 0;
				lastTime = 0;
				$('#duration').html('--:--');
			},
			restart: function() {
				this.stop();
				this.start();
			}
		};
	})();

	function checkState() {
//		logger.log("checkState");
		if (session.state == Session.DEAD || station.state == Station.PENDING) return;

		var stationInfo = (station.deviceId && ('<p>分机：' + station.deviceId + '</p>')) || '';
		stationInfo += (agent.agentId && ('<p>登录名：' + agent.loginName + '</p><p>工号：' + agent.agentId + '</p>')) || '';
		$('#stationInfo').html(stationInfo);

		switch (agent.mode) {
			//		case Agent.LOGIN:
			//			break;
		case Agent.READY:
			calcDuration.restart();
			$('#state').html('就绪');
			break;
		case Agent.NOT_READY:
			calcDuration.restart();
			$('#state').html('离席');
			break;
		case Agent.WORK_NOT_READY:
			calcDuration.restart();
			$('#state').html('后处理');
			break;
		case Agent.LOGOUT:
		case Agent.PENDING:
			calcDuration.stop();
			$('#state').html('未登录');

			// 避免Session在退出工号时被意外结束掉
			if (station.state == Station.MONITORED) {
				session.end().then(function() {
					checkButton();
				});
			}
			stationInfo = '';
			$('#callsInQueue').html("--");
			break;
		default:
			break;
		}
		$('#stationInfo').html(stationInfo);
	}
	// 监听坐席状态改变事件
	event.on('user.AgentStateChange', function(e) {
		if (e.srcDeviceId != station.deviceId) return;
		checkState();
	});
	// 监听组状态改变事件
	event.on('user.Snapshot', function(e) {
		if (e.srcDeviceId != group.deviceId) return;
		$('#callsInQueue').html(group.callsInQueue);
	});
	event.on('user.Disconnected', function() {
		checkButton();
		widget.alert('连接断开!');
	});
	event.on('user.Connecting', function(e) {
		checkButton();
		widget.alert('正在重连(' + e.reconnectAttempts + ')...');
	});
	event.on('user.Reconnected', function(e) {
		checkButton();
		widget.alert('重连成功，正在恢复数据...');
	});
	event.on('user.Recovered', function(e) {
		checkButton();
		if (e.length) {
			widget.alert('恢复出现异常');
		} else {
			widget.alert('恢复成功');
		}
	});
	event.on('user.Delivered', function(e) {
		if (e.srcDeviceId != station.deviceId) return;
		var call = station.calls.get(e.callId);
		widget.alert("来电弹屏："+ call.callId + " " + call.contactId + " " + call.createTime);
		if (!call) return;
		// 来电
		if ("In" == call.direction) {
			$.messager.show({
				title: '消息',
				msg: '来电：' + call.ani,
				timeout: 5000,
				showType: 'slide'
			});
			// 去电
		} else if ("Out" == call.direction) {
			if (playAgentNo && call.dnis == ivrNo) {
				//********************模拟自动应答(仅供测试)********************/
				if (simulateIvr) {
					session.socket.send({
						method: "answerCall",
						object: "cti",
						params: [{
							callId: e.callId,
							deviceId: e.alertingDevice
						}]
					}).then(function() {
						setTimeout(function() {
							session.socket.send({
								method: "clearConnection",
								object: "cti",
								params: [{
									callId: e.callId,
									deviceId: e.alertingDevice
								}]
							});
						}, 6000);
					})['catch'](function() {
						console.warn("模拟自动应答失败");
					});
				}
				//*****************************END******************************/
				station.conference({
					type: 'PLAY_AGENT_NO'
				}).then(function(e) {
					console.info('加入IVR成功');
				})['catch'](function(e) {
					// 错误处理
					widget.error(e.message);
				});
			}
		}
	});
	// 报工号
	event.on('user.Established', function(e) {
		if (!e || !e.srcDeviceId || e.srcDeviceId != station.deviceId) return;
		// 判断号码
		console.log(e);
		if (playAgentNo && e.answeringDevice && e.srcDeviceId == station.deviceId && e.answeringDevice == station.deviceId && e.callingDevice && e.split) {
			// 外线->调用consultation接口，参数填IVR号码
			station.consultation(ivrNo, {
				type: 'PLAY_AGENT_NO',
				userData: {
					map: {
						agentid: agent.agentId,
						'function': 'playAgentNO'
					}
				}
			})['catch'](function(e) {
				// 错误处理
				widget.error(e.message);
			});
		}
	});

	function checkButton(e) {
		console.log('checkButton');
		if (session.state != Session.ALIVE && station.state != Station.MONITORED) {
			$('#dial').linkbutton('disable');
			$('#answer').linkbutton('disable');
			$('#drop').linkbutton('disable');
			$('#hold').linkbutton('disable');
			$('#retrieve').linkbutton('disable');
			$('#conference').linkbutton('disable');
			$('#conference').show();
			$('#transfer').linkbutton('disable');
			$('#transfer').show();
			$('#completeConference').linkbutton('disable');
			$('#completeConference').hide();
			$('#completeTransfer').linkbutton('disable');
			$('#completeTransfer').hide();
			$('#consultation').linkbutton('disable');
			$('#singleStepTransfer').linkbutton('disable');
			$('#satisfaction').linkbutton('disable');
			$('#callCount').html('-');
			return;
		};
		if (!e || e.source == station.deviceId) {
			var that = station;
			var activeCall = that.calls.get(that.calls.activeCall);
			var heldCall = that.calls.filter({
				isHeld: true
			}).getLast();
			var ringingCall = that.calls.filter({
				state: Call.RINGING
			}).getLast();
			var consultationFrom = that.calls.get(that.calls.consultationFrom);
			var consultationTo = that.calls.get(that.calls.consultationTo);

			$('#callCount').html(that.calls.length);
			// 可否外拨
			if (that.calls.length > 2 || that.calls.length == 1 && that.calls.getLast() && that.calls.getLast().state != Call.OFFHOOK) {
				$('#dial').linkbutton('disable');
			} else {
				$('#dial').linkbutton('enable');
			}
			// 可否接听
			if (!ringingCall) {
				$('#answer').linkbutton('disable');
				//				$('#answerPanel').fadeOut('fast');
			} else {
				$('#answer').linkbutton('enable');
			}
			// 可否挂断
			if (!that.calls.length || that.calls.filter({
				state: Call.RINGING
			}).length == that.calls.length) {
				$('#drop').linkbutton('disable');
			} else {
				$('#drop').linkbutton('enable');
			}
			// 可否保持
			if (!activeCall) {
				$('#hold').linkbutton('disable');
			} else {
				$('#hold').linkbutton('enable');
			}
			// 可否恢复
			if (!heldCall) {
				$('#retrieve').linkbutton('disable');
			} else {
				$('#retrieve').linkbutton('enable');
			}
			// 可否磋商
			if (!that.calls.length // 没有电话
			|| activeCall && Call.CONNECTED != activeCall.state // 有激活的，激活的不是通话状态
			|| !activeCall && !heldCall || heldCall && heldCall.state != Call.CONNECTED // 没激活的，没有保持的电话或者最后保持的不是通话状态
			) {
				$('#consultation').linkbutton('disable');
				$('#conference').linkbutton('disable');
				$('#transfer').linkbutton('disable');
			} else {
				$('#consultation').linkbutton('enable');
				$('#conference').linkbutton('enable');
				$('#transfer').linkbutton('enable');
			}
			// 可否单转
			if (!activeCall || activeCall.state != Call.CONNECTED) {
				$('#singleStepTransfer').linkbutton('disable');
				$('#satisfaction').linkbutton('disable');
			} else {
				$('#singleStepTransfer').linkbutton('enable');
				$('#satisfaction').linkbutton('enable');
			}
			// 可否会议//转移
			if (!activeCall || !consultationTo || activeCall.callId != consultationTo.callId // 与磋商目标电话不一致
			|| !consultationFrom || !consultationFrom.isHeld || consultationFrom.state != Call.CONNECTED) {
				$('#completeConference').linkbutton('disable');
				$('#completeTransfer').linkbutton('disable');

				$('#conference').show();
				$('#completeConference').hide();
				$('#transfer').show();
				$('#completeTransfer').hide();
			} else {
				if (that.calls.consultationType == 'transfer') {
					$('#completeConference').linkbutton('disable');
					$('#completeTransfer').linkbutton('enable');

					$('#conference').show();
					$('#completeConference').hide();
					$('#transfer').hide();
					$('#completeTransfer').show();
				} else if (that.calls.consultationType == 'conference') {
					$('#completeConference').linkbutton('enable');
					$('#completeTransfer').linkbutton('disable');

					$('#conference').hide();
					$('#completeConference').show();
					$('#transfer').show();
					$('#completeTransfer').hide();
				} else {
					$('#completeConference').linkbutton('disable');
					$('#completeTransfer').linkbutton('disable');

					$('#conference').show();
					$('#completeConference').hide();
					$('#transfer').show();
					$('#completeTransfer').hide();
				}
			}
		}
		console.log('completeCheckButton');
	}
	var talkState = false;
	// 监听电话改变事件
	event.on('user.StationStateChange', function(e) {
		if (e.source != station.deviceId) return;
		checkButton(e);
		if (talkState && station.calls.size() == 0) {
			talkState = false;
			calcDuration.restart();
		} else if (!talkState && station.calls.size() > 0) {
			talkState = true;
			calcDuration.restart();
		}
	});
	// 点击签入按钮先连接后登录
	$('#login').on('click', function() {
		// 调用session的start接口连接服务器
		var startPromise;
		if (connectType == 1) {
			startPromise = session.start(dcmpAddr, connector);
		} else {
			startPromise = session.start(connectors);
		}
		startPromise.then(function() {
			// 调用agent的signIn接口登录
			return station.signIn($('#deviceId').val(), $('#agentId').val(), $('#password').val());
			// 登录成功的处理函数
		}).then(function(e) {
			checkButton();
			widget.alert('签入成功');
			if (callsWaiting && group.state == Station.PENDING && agent.queues[0]) {
				group.monitor(agent.queues[0].queueId);
			}

			//			var html = '';
			for (var reason in session.reasons) {
				//				html += '<div>' + session.reasons[reason].name + '</div>';
			}
			// 登录失败的处理函数
		})['catch'](function(e) {
			session.end();
			checkButton();
			widget.error(e.message);
		});
	});

	$('#ready').click(function() {
		station.setMode(Agent.READY).then(function(e) {
			widget.alert('就绪成功');
		})['catch'](function(e) {
			widget.error(e.message);
		});
	});

	$('#notReady').click(function() {
		station.setMode(Agent.NOT_READY, {
			reason: $('#reason').val()
		}).then(function(e) {
			widget.alert('离席成功');
		})['catch'](function(e) {
			widget.error(e.message);
		});
	});
	$('#workNotReady').click(function() {
		station.setMode(Agent.WORK_NOT_READY).then(function(e) {
			widget.alert('后处理成功');
		})['catch'](function(e) {
			widget.error(e.message);
		});
	});
	$('#logout').click(function() {
		$('#statePanel').hide();
		station.signOut().then(function(e) {
			return session.end();
		}).then(function(e) {
			checkButton();
			widget.alert('签出成功');
		})['catch'](function(e) {
			widget.error(e.message);
		});
	});
	// 外拨
	$('#dial').on('click', function() {
		station.dial($('#number').val()).then(function(e) {
			console.info('外拨');
		})['catch'](function(e) {
			checkButton();
			widget.error(e.message);
		});
	});
	$('#answer').on('click', function() {
		station.answer().then(function(e) {
			console.info('应答');
		})['catch'](function(e) {
			checkButton();
			widget.error(e.message);
		});
	});
	$('#drop').on('click', function() {
		station.drop().then(function(e) {
			console.info('挂断');
		})['catch'](function(e) {
			checkButton();
			widget.error(e.message);
		});
	});
	$('#hold').on('click', function() {
		station.hold().then(function(e) {
			console.info('保持');
		})['catch'](function(e) {
			checkButton();
			widget.error(e.message);
		});

	});
	$('#retrieve').on('click', function() {
		station.retrieve().then(function(e) {
			console.info('恢复');
		})['catch'](function(e) {
			checkButton();
			widget.error(e.message);
		});
	});
	//	userData: {
	//		map:{
	//			agentid:agent.agentId,
	//			'function':'playAgentNO'
	//		}
	//	}
	$('#consultation').on('click', function() {
		station.consultation($('#number').val(), {
			type: 'consultation'
		}).then(function(e) {
			console.info('磋商');
		})['catch'](function(e) {
			checkButton();
			widget.error(e.message);
		});
	});
	$('#conference').on('click', function() {
		station.consultation($('#number').val(), {
			type: 'conference'
		}).then(function(e) {
			console.info('磋商');
		})['catch'](function(e) {
			checkButton();
			widget.error(e.message);
		});
	});
	$('#transfer').on('click', function() {
		station.consultation($('#number').val(), {
			type: 'transfer'
		}).then(function(e) {
			console.info('磋商');
		})['catch'](function(e) {
			checkButton();
			widget.error(e.message);
		});
	});
	// 完成会议
	$('#completeConference').on('click', function() {
		station.conference({
			type: 'conference',
		}).then(function(e) {
			console.info('会议');

		})['catch'](function(e) {
			checkButton();
			widget.error(e.message);
		});
	});
	// 完成转移
	$('#completeTransfer').on('click', function() {
		station.transfer({
			type: 'transfer',
		}).then(function(e) {
			console.info('转移');

		})['catch'](function(e) {
			checkButton();
			widget.error(e.message);
		});
	});
	// 单转
	$('#singleStepTransfer').on('click', function() {
		station.singleStepTransfer($('#number').val()).then(function(e) {
			console.info('单转');

		})['catch'](function(e) {
			checkButton();
			widget.error(e.message);
		});
	});
	// 满意度
	$('#satisfaction').on('click', function() {
		var activeCall = station.calls.get(station.calls.activeCall);
		station.singleStepTransfer(satisfaction, {
			// 随路数据
			userData: {
				map: {
					v: satisfaction,
					//transfer: "3"
					i: agent.agentId,
					u: activeCall.contactId,
					a: activeCall.ani,
					d: activeCall.dnis
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
	
	// 查询技能组
	$('#AllQueues').on('click', function() {
		
		Query.queryAllQueues();
	});

});