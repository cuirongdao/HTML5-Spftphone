@echo on
cd /d %~dp0
set version=2.2.5
set dirname=%~dp0\h5client-%version%(%date:~0,4%.%date:~5,2%.%date:~8,2%)


xcopy %~dp0\cfg\test-h5client.cfg.js %dirname%\cfg\
xcopy %~dp0\docs %dirname%\docs\ /e
xcopy %~dp0\lib\ccwidget %dirname%\lib\ccwidget\ /e
xcopy %~dp0\lib\jquery %dirname%\lib\jquery\ /e
xcopy %~dp0\lib\jquery-easyui %dirname%\lib\jquery-easyui\ /e
xcopy %~dp0\required %dirname%\required\ /e
xcopy %~dp0\test\test-h5client.js %dirname%\test\
copy %~dp0\index.html %dirname%\
copy %~dp0\หตร๗.txt %dirname%\
cd %dirname%\required\

java -jar %~dp0\yuicompressor-2.4.8.jar h5client.js -o h5client.min.js --charset utf-8
del h5client.js
ren h5client.min.js h5client.js
pause