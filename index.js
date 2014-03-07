'use strict';

var sourcemap = require('source-map');
var SourceMapConsumer = sourcemap.SourceMapConsumer;
var SourceMapNode = sourcemap.SourceNode;
var SourceMapGenerator = sourcemap.SourceMapGenerator;
var fs = require('fs');
var path = require('path');

function _concatFromSource(files, options) {
	
	var sourceMapNode = new SourceMapNode();
	
	files.forEach(function(file) {
		
		var src = file.code;
		var map = file.map;
		var filePath = file.path;
		
		var lines = src.split('\n');
		
		for (var j = 0, k = lines.length - 1; j < k; j++) {
			lines[j] += '\n';
		}
		
		if(map) {
			
			map = JSON.parse(map.toString());
		
			map.file = filePath;
		
            map.sources = map.sources.map(function(source){
              return path.join(path.dirname(filePath), source);
            });
		
            delete map.sourceRoot;
			
			var consumer = new SourceMapConsumer(map);
			
			lines.forEach(function(line, k) {
				
				var position = consumer.originalPositionFor({
					line: k +1,
					column: 0
				});
			
				sourceMapNode.add(new SourceMapNode(position.line, position.column, position.source, line.replace(/[@#]\s+sourceMappingURL=[\w\.]+/, ''), position.name));
			
			});
			
			
		} else {
			
			
			lines.forEach(function(line, k) {
			
				sourceMapNode.add(new SourceMapNode(k + 1, 0, filePath, line.replace(/[@#]\s+sourceMappingURL=[\w\.]+/, '')));
			
			});
			
		}
		
		sourceMapNode.add(';\n');
	});

	sourceMapNode.add('//# sourceMappingURL=' + options.mapFilePath);

    var sourceCodeMap = sourceMapNode.toStringWithSourceMap();
	
    var generator = SourceMapGenerator.fromSourceMap(new SourceMapConsumer(sourceCodeMap.map.toJSON()));
	
	return {
		code: sourceCodeMap.code,
		map: generator.toString()
	}
}

exports.concatFromSource = function(files, options, callback) {
	
	try{
		
		process.nextTick(function() {
			
			callback(null, concatFromSource(files, options))
			
		})
		
	} catch(err) {
		
		process.nextTick(function() {
			
			callback(err);
			
		})
	}
	
}

function concatFromFiles(files, options, callback) {
	
	var filesToConcat = [];
	
	var total = files.length;
	
	var thrown = false;
	
	files.forEach(function(file) {
		
		fs.readFile(file, function(err, data) {
			
			if(err) {
				
				if(!thrown) {
					
					thrown = true;
				
					callback(err);
					
				}
					
				
			} else {
				
				data = data.toString();
				
				var sourceMapPath = false;
				
				data.split('\n').forEach(function(line) {
					
					if(/\/\/[@#]\s+sourceMappingURL=(.+)/.test(line)) {
						sourceMapPath = /\/\/[@#]\s+sourceMappingURL=(.+)/.exec(line)[1];
					}
					
				})
				
				var runIfAll = function() {
					
					if(!total) {
				
						try {
					
							callback(null, _concatFromSource(filesToConcat, options));
					
						} catch (err) {
					
							callback(err);
					
						}
				
					}
					
				}
				
				if(sourceMapPath) {
					
					sourceMapPath = path.resolve(path.dirname(file), sourceMapPath);
					
					fs.readFile(sourceMapPath, function(err, mapData) {
						
						total--;
						
						if(mapData) {
							
							mapData = mapData.toString();
							
							filesToConcat.push({src: data, map: mapData, path: file});
							
						} else {
							
							filesToConcat.push({src: data, map: null, path: file});
							
						}
						
						runIfAll();
						
					});
					
				} else {
					
					total--;
					
					filesToConcat.push({src: data, map: null, path: file});
					
					runIfAll();
					
				}
			}
			
		});
		
	});
}

exports.concatFromFiles = concatFromFiles;