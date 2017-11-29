// Node modules.
var gm = require('gm'),
  grunt = require('grunt'),
  gruntSpritesmith = require('grunt-spritesmith'),
  path = require('path'),
  _ = require('lodash'),
  sizeOf = require('image-size');

module.exports = function(grunt) {

  // The function that constitutes the Grunt task.
  var spriteHD = function() {

    // Start async (required for grunt-spritesmith to work).
    var done = this.async();

    // Settings.
    var data = this.data,
      options = this.options(),
      src = data.src, // required
      spriteName = data.spriteName, // required

      // For grunt-spritesmith
      destImg = options.destImg || 'images/sprites',
      destCSS = options.destCSS || 'style/scss/sprites',
      imgPath = typeof options.imgPath === 'string' ? options.imgPath : path.relative(destCSS, destImg),
      algorithm = options.algorithm || 'binary-tree',
      padding = options.padding || 1,
      engine = options.engine || 'gmsmith',
      engineOpts = options.engineOpts || {},
      imageOpts = options.imageOpts || {},
      cssOpts = options.cssOpts || {},
      hdCssTemplate = options.hdCssTemplate ||  undefined,
      ldCssTemplate = options.ldCssTemplate || path.join(__dirname, 'templates/scss-hd.template.mustache'),
      algorithmOpts = options.algorithmOpts || {},

      // Other
      resizeEngine = options.resizeEngine || 'gmsmith',
      assetFormats = options.assetFormats || ['.png', '.jpg', '.jpeg'],
      tempAssets = options.tempAssetsFolder || 'tempAssets',
      hd = options.hd !== false,
      hdPrefix = options.hdPrefix || 'hd',
      ldPrefix = options.ldPrefix || 'ld',
      functions = options.functions || true,
      failOnOddImageSize = options.failOnOddImageSize || false,
      imgType = 'png';

    //test the optionally passed template paths to abort as early as possible
    if (hdCssTemplate && !grunt.file.exists(hdCssTemplate)) {
      if (grunt.file.exists(path.join(__dirname, hdCssTemplate))) {
        hdCssTemplate = path.join(__dirname, hdCssTemplate);
      } else {
        grunt.fail.fatal('The template passed as hdCssTemplate at "' + hdCssTemplate + '" could not be found.');
      }
    }
    if (!grunt.file.exists(ldCssTemplate)) {
      if (grunt.file.exists(path.join(__dirname, ldCssTemplate))) {
        ldCssTemplate = path.join(__dirname, ldCssTemplate);
      } else {
        grunt.fail.fatal('The template passed as ldCssTemplate at "' + ldCssTemplate + '" could not be found.');
      }
    }

    // Derivations from the settings.
    var srcFiles = grunt.file.expand(src),

      hdImageName = hdPrefix + '-' + spriteName + '.' + imgType,
      hdDestImg = path.join(destImg, hdImageName),
      hdImgPath = path.join(imgPath, hdImageName),
      hdStyleName = '_sprite-' + spriteName + '-hd.scss',
      hdDestCSS = path.join(destCSS, hdStyleName),
      hdAssetDir = path.join(tempAssets, hdPrefix + '-' + spriteName + '-assets'),

      ldImageName = ldPrefix + '-' + spriteName + '.' + imgType,
      ldDestImg = path.join(destImg, ldImageName),
      ldImgPath = path.join(imgPath, ldImageName),
      ldStyleName = '_sprite-' + spriteName + '.scss',
      ldDestCSS = path.join(destCSS, ldStyleName),
      ldAssetDir = path.join(tempAssets, ldPrefix + '-' + spriteName + '-assets'),

      regImageName = spriteName + '.' + imgType,
      regDestImg = path.join(destImg, regImageName),
      regDestPath = path.join(imgPath, regImageName),
      regStyleName = '_sprite-' + spriteName + '.scss',
      regDestCSS = path.join(destCSS, ldStyleName),

      spritesmithParams = {
        'algorithm': algorithm,
        'algorithmOpts': algorithmOpts,
        'engine': engine,
        'engineOpts': engineOpts,
        'imageOpts': imageOpts
      };

    function deleteTempAssets(dir) {
      if (typeof dir !== 'string' || grunt.file.exists(dir) === false) {
        dir = tempAssets;
      }
      grunt.log.ok('Deleting temporary assets at ' + dir + ' ...');
      grunt.file.delete(dir);
    }

    function end() {
      deleteTempAssets();
      done(true);
      return;
    }

    // Register grunt-spritesmith
    gruntSpritesmith(grunt);

    /*============================
    IF NO HD, RUN REGULAR SPRITESMITH
    ==============================*/

    if (!hd) {
      var regSpritesmithParams = {
        'reg': {
          'src': src,
          'dest': regDestImg,
          'destCss': regDestCSS,
          'imgPath': regDestPath,
          'padding': padding,
          'cssOpts': cssOpts
        }
      };
      _.extend(regSpritesmithParams.reg, spritesmithParams);

      var regConfig = _.extend(grunt.config.getRaw(), {
        'sprite': regSpritesmithParams
      });
      grunt.config.init(regConfig);
      grunt.task.run('sprite:reg');
      grunt.log.ok('Regular spritesheet created.');
      end();
    }

    /*============================
    Prepare resizer (either gm or im)
    ==============================*/
    // First, prepare to the gm module to use ImageMagick if it needs to
    var resizer = gm;
    if (resizeEngine !== 'gmsmith') {
      if (resizeEngine === 'im') {
        grunt.log.ok('Setting resizer to ImageMagick ...');
        // per http://aheckmann.github.io/gm/docs.html#imagemagick
        resizer = gm.subClass({
          imageMagick: true
        });
      } else {
        grunt.log.error('spritesmithHD\'s resizeEngine must be either `gmsmith` (GraphicsMagick) or `im` (ImageMagick).');
        end();
      }
    }

    /*============================
    Create full-size assets for HD spritesheet
    ==============================*/

    grunt.log.writeln('Creating temporary ' + hdPrefix + ' assets ...');
    _.forEach(srcFiles, function(file) {
        var dimensions = sizeOf(file);
        if((dimensions.width % 2 !== 0) || (dimensions.height % 2 !== 0) )
        {
          var warningMessage = 'The file \''+file+'\' size is not correct. The image size is is: '+dimensions.width+'px width and '+dimensions.height+'px height.';
          if(failOnOddImageSize)
          {
              grunt.fail.fatal(warningMessage);
          }else{
              grunt.log.error(warningMessage);
          }
        }
      var newName = (typeof cssOpts.varPrefix != 'undefined' ? cssOpts.varPrefix : '') + hdPrefix + '-' + path.basename(file);
      grunt.file.copy(file, path.join(hdAssetDir, newName));
    });

    /*============================
    Create resized assets for LD spritesheet
    ==============================*/

    grunt.log.writeln('Creating temporary ' + ldPrefix + ' assets ...');

    // Create the LD asset directory.
    if (grunt.file.exists(ldAssetDir)) {
      grunt.log.error('An existing directory is getting in the way of spritesmithHD creating a temporary LD asset directory at ' + ldAssetDir + '. It\'s being overwritten.');
      deleteTempAssets(ldAssetDir);
    }
    grunt.file.mkdir(ldAssetDir);

    // For each file:
    // - add its name to resizedImages array;
    // - create a 50%-sized duplicate in ldAssetsDir;
    // - check for errors;
    // - if it's the last one, run spritesmith.

    var resizedImages = [],
      i = 0,
      counter = function(err) {
        if (err) {
          grunt.log.error(err);
          end();
        }
        i++;
        if (i === srcFiles.length) {
          grunt.log.ok('LD assets done.');
          makeSpritesmithGo();
        }
      };

    srcFiles.forEach(function(file) {
      var ext = path.extname(file);

      if (_.includes(assetFormats, ext)) {
        var filename = path.basename(file),
          pathToTarget = path.join(ldAssetDir, filename);
        resizedImages.push(pathToTarget);
        resizer(file).resize(50, 50, '%')
          .write(pathToTarget, counter);
      }
    });

    var makeSpritesmithGo = function() {

      /*============================
      PREP SPRITESMITH SETTINGS
      ==============================*/

      var hdSpritesmithParams = {
        'hd': {
          'src': [hdAssetDir + '/*'],
          'dest': hdDestImg,
          'destCss': hdDestCSS,
          'imgPath': hdImgPath,
          'padding': padding * 2,
          'cssOpts': {
            'functions': false,
            'spriteName': spriteName
          }
        }
      };
      if (hdCssTemplate !== undefined) {
        _.extend(hdSpritesmithParams.hd, {
          'cssTemplate': hdCssTemplate
        });
      }
      _.extend(hdSpritesmithParams.hd, spritesmithParams);

      var ldSpritesmithParams = {
        'ld': {
          'src': [ldAssetDir + '/*'],
          'dest': ldDestImg,
          'destCss': ldDestCSS,
          'imgPath': ldImgPath,
          'padding': padding,
          'cssTemplate': ldCssTemplate
        }
      };
      ldSpritesmithParams.ld.cssOpts = _.extend(cssOpts, {
        'hdPath': hdStyleName,
        'hdPrefix': hdPrefix,
        'spriteName': spriteName,
      });
      _.extend(ldSpritesmithParams.ld, spritesmithParams);

      var allParams = _.extend(hdSpritesmithParams, ldSpritesmithParams),
        config = _.extend(grunt.config.getRaw(), {
          'sprite': allParams
        });
      grunt.config.init(config);

      /*============================
      RUN GRUNT-SPRITESMITH
      ==============================*/

      grunt.task.run('sprite:hd');
      grunt.task.run('sprite:ld');

      // When that's all done, delete temp assets
      process.on('exit', deleteTempAssets);

      // async business
      done(true);

    };

  };

  // Register the task with Grunt.
  grunt.registerMultiTask('spriteHD', 'HD-ready spritesheets with grunt.', spriteHD);
};