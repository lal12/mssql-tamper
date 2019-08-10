# mssql-tamper

This project contains a proxy for manipulating packet data coming from and going to a Microsoft SQL Server. 

I created this currently only as a proof of concept. Therefore there currently is no configuration, and to change its behaviour you have to edit the code.

If interested have a look at `src/manipulator.ts` where all the manipulation logic resides. Currently it will replace the build version `14.x.x.x` with `13.0.4574.0` and the edition string `Express Edition*` with `Developer Edition (64bit)`.
In `src/main.ts` you can change the tcp ports and IP of the real DB.

This project heavily relies on the library [tedious](https://github.com/tediousjs/tedious) for parsing and working with the TDS protocol, which is used by mssql, so huge thanks to its developers.

## How to use

All commands should be run inside the root folder of this repository. Also NodeJS needs to be installed.

- Installing dependencies: `npm install .`
- Building: `npx tsc` or `node_modules/.bin/tsc`
- Running: `node build/main.js`

## TODO

Currently it only manipulates packets from the server containing an answer to a query. However it probably would be better to manipulate the query instead of guessing which is the correct data to manipulate. This probably wouldn't be a ton of work and I might do that in the future.  


## Story

I have a CAD software called Trimble Nova (formerly Plancal Nova), this software ships with it own collaboration server over which multiple people can work on one project at the same time. However this server is not programmed very well (as is the CAD software itself) and has massive issues.
Therefore they offer to use mssql server and doing so improves the working experience very much. However they forbid the use of the Express Edition and newer Versions than 2016. But there is no real technical reason behind it, since the only limitation of the Express Edition is the maximum memory usage and maximum database size. And since Nova uses MSSQL merely as a simple lookup table (maybe with locks), fancy features of MSSQL aren't needed anyway.

So this projects solves the issue for me, and just sends a fake version string to clients, tricking them into thinking it is a 2016 Developer Edition.

