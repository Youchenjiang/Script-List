@echo off
if "%PATH_TO_JAVA%"=="" set PATH_TO_JAVA=java
"%PATH_TO_JAVA%" -jar "%~dp0apktool.jar" %*
