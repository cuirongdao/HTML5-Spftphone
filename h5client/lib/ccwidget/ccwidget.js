var CCWidget = (function(){
		var alertFram = document.createElement("DIV");
		alertFram.style.minWidth = '240px';
		alertFram.style.maxWidth = '480px';
		alertFram.style.minHeight = '36px';
//		alertFram.style.fontFamily = '黑体';
		alertFram.style.padding = '2px 40px';
		alertFram.style.display = 'none';
		alertFram.style.position = 'absolute';
		alertFram.style.color = 'white';
		alertFram.style.textAlign = 'center';
		alertFram.style.borderRadius = '5px';
		alertFram.style.fontSize = '20px';
		alertFram.style.lineHeight = '40px';
		alertFram.style.backgroundColor="#1A6FE6";
		alertFram.style.backgroundColor="#EC4327";
		alertFram.style.zIndex = "10000";
		alertFram.style.wordWrap = "break-word";
		alertFram.style.boxShadow = '0 2px 5px 0 rgba(0,0,0,0.26)';
		$(alertFram).html('提示');
		document.body.appendChild(alertFram);
		$(window).resize(function(){
			$(alertFram).css({
				left: ($(window).width() - $(alertFram).outerWidth())/2,
				top: ($(window).height() - $(alertFram).outerHeight())/2 + $(document).scrollTop() ,
			});
		});
		// 最初运行函数
		$(window).resize();
		var timer = 0;
		return {
			alert: function(text){
				$(alertFram).stop(true);
				window.clearTimeout(timer);
				$(document).not(alertFram).one('click',function(){
					$(alertFram).fadeOut(1000);
				});
				alertFram.style.backgroundColor="#1A6FE6";
				$(alertFram).html(text);
				$(window).resize();
				$(alertFram).fadeIn('fast');
				timer = window.setTimeout(function(){
					$(alertFram).fadeOut('slow');
				}, 3000);
			},
			error:function(text){
				$(alertFram).stop(true);
				window.clearTimeout(timer);
				$(alertFram).one('click',function(){
					$(alertFram).fadeOut('slow');
				});
				alertFram.style.backgroundColor="#EC4327";
				$(alertFram).html(text);
				$(window).resize();
				$(alertFram).fadeIn('fast');
				window.setTimeout(function(){
				}, 6000);
			},
		};
	});
	var Button = (function(){
		var button = {};
		var _id = '';
		button = {
				toggle: function(id, state){
					_id = id||_id;
					switch (state) {
					case 1:
						document.getElementById(id).setAttribute('state', '1');
						document.getElementById(id).disabled = false;
						break;
					case 2:
						document.getElementById(id).setAttribute('state', '2');
						document.getElementById(id).disabled = true;
						break;
					case 3:
						document.getElementById(id).setAttribute('state', '3');
						document.getElementById(id).disabled = true;
						break;

					default:
						break;
					}
					return button;
				},
				show:function(id){
					_id = id||_id;
					document.getElementById(id||_id).style.display = 'inline-block';
					return button;
				},
				hide:function(id){
					_id = id||_id;
					document.getElementById(id||_id).style.display = 'none';
					return button;
				}
			};
		return button;
	})();