/* Const variables for required modiles */

const autoprefixer      = require('gulp-autoprefixer'),
      babel             = require('gulp-babel'),
      browserSync       = require('browser-sync'),
      changed           = require('gulp-changed'),
      cheerio           = require('gulp-cheerio'),
      cleaner           = require('gulp-clean'),
      concat            = require('gulp-concat'),
      cssParser         = require('css'),
      cssnano           = require('gulp-cssnano'),
      data              = require('gulp-data'),
      del               = require('del'),
      footer            = require('gulp-footer'),
      fs                = require('fs'),
      fsExtra           = require('fs-extra'),
      gulp              = require('gulp'),
      header            = require('gulp-header'),
      htmlMin           = require('gulp-htmlmin'),
      inject            = require('gulp-inject'),
      merge             = require('merge-stream'),
      plumber           = require('gulp-plumber'),
      prettyHtml        = require('gulp-pretty-html'),
      readYaml          = require('read-yaml'),
      removeEmptyLines  = require('gulp-remove-empty-lines'),
      rename            = require('gulp-rename'),
      replace           = require('gulp-replace'),
      sass              = require('gulp-sass'),
      sassGlob          = require('gulp-sass-glob'),
      sourcemaps        = require('gulp-sourcemaps'),
      svgmin            = require('gulp-svgmin'),
      svgSprite         = require('gulp-svg-sprite'),
      template          = require('gulp-template'),
      twig              = require('gulp-twig'),
      uglify            = require('gulp-uglify');


/* Variable for config */
var configGlobal = './config-default.yml';

if (fs.existsSync('./config.yml')) {
  configGlobal = './config.yml';
}


/* Define all paths */

const paths = {
  src: {
    __core:     'src/__core/',
    assets:     'src/assets/',
    components: 'src/components/',
    includes:   'src/includes/',
    layouts:    'src/layouts/',
    pages:      'src/pages/',
  },
  build: 'dist/',
};


/* BrowserSync Init and Reload */

function browserSyncInit(done) {
  browserSync.init({
    server: {
      baseDir: 'src/',
      index: 'src-pages.html',
    },
    notify: false,
    port: 3000,
  });
  done();
}

function browserSyncReload(done) {
  browserSync.reload();
  done();
}


/* Separate server run for build. No reloads and other tasks */

function runbuild(done) {
  browserSync.init({
    server: {
      baseDir: paths.build,
      index: 'src-pages.html',
    },
    notify: false,
    port: 3000,
  });
  done();
}


/* Generate layout helpers template */

function layoutHelpers() {

  const layoutHelpersTwig = gulp
    .src(`${paths.src.__core}__layout-helpers/layout-helpers.twig`)
    .pipe(data(() => readYaml.sync(configGlobal)))
    .pipe(twig())
    .pipe(gulp.dest(`${paths.src.__core}__layout-helpers/`));

  const layoutHelpersCss = gulp
    .src(`${paths.src.__core}__layout-helpers/layout-helpers.scss`)
    .pipe(plumber({ handleError(err) { console.log(err); this.emit('end'); } }))
    .pipe(sassGlob())
    .pipe(sass({ errLogToConsole: true }))
    .pipe(autoprefixer(['last 10 versions', '> 1%', 'IE 11'], { cascade: true }))
    .pipe(gulp.dest(`${paths.src.assets}css/`));

  return merge(layoutHelpersTwig, layoutHelpersCss);

}


/* Compiling HTML */

/* Delete all generated files */

function htmlClean() {
  return gulp
    .src([`src/*.html`], { read: false, force: true })
    .pipe(cleaner());
}


/* Compile all pages/*.twig independentely on cache */

function htmlCompileAll() {
  return gulp
    .src([`${paths.src.pages}*.twig`])
    .pipe(plumber({ handleError(err) { console.log(err); this.emit('end'); } }))
    .pipe(data(() => readYaml.sync(configGlobal)))
    .pipe(twig({ base: 'src/' }))
    .pipe(gulp.dest('src'));
}


/* Compile all pages/*.twig independentely on cache */

function htmlCompileChanged() {
  return gulp
    .src([`${paths.src.pages}*.twig`])
    .pipe(changed('src', {extension: '.html'}))
    .pipe(plumber({ handleError(err) { console.log(err); this.emit('end'); } }))
    .pipe(data(() => readYaml.sync(configGlobal)))
    .pipe(twig({ base: 'src/' }))
    .pipe(gulp.dest('src'));
}


/* Put links for all generated html */

function htmlLinks() {
  return gulp
    .src(`${paths.src.__core}src-pages.html`)
    .pipe(plumber({ handleError(err) { console.log(err); this.emit('end'); } }))
    .pipe(inject(
      gulp.src(['src/*.html', '!src/src-pages.html'], { read: false }), {
      transform(filepath) {
        filepath = filepath.split('/src/').join('');
        if (filepath.slice(-5) === '.html') {
          return `<li><a href="${filepath}">${filepath}</a></li>`;
        }
        return inject.transform.apply(inject.transform);
      },
      },
    ))
    .pipe(prettyHtml({ indent_size: 4, end_with_newline: true }))
    .pipe(gulp.dest('src'));
}


/* Initial compiling on watch: clear src/*.html, compile all templates, insert links into src-pages.html */
const html        = gulp.series(htmlClean, htmlCompileAll, htmlLinks);

/* On any change in {components|includes|layouts} recompile all templates, but don't update links — pages/.*twig still same */
const htmlInserts = gulp.series(htmlCompileAll);

/* On any change of pages/*.twig, recompilem them smart using gulp-changed */
const htmlPages   = gulp.series(htmlCompileChanged, htmlLinks);


/* Compiling CSS on 'watch' or 'build' into src/assets/css/** */

function cssCore() {
  return gulp
    //.src([`${paths.src.__core}__core-scss/*.scss`, `!${paths.src.__core}__core-scss/custom.scss`])
    .src([`${paths.src.assets}scss/style.scss`])
    .pipe(plumber({ handleError(err) { console.log(err); this.emit('end'); } }))
    .pipe(sassGlob())
    .pipe(sass({ errLogToConsole: true }))
    .pipe(autoprefixer(['last 10 versions', '> 1%', 'IE 11'], { cascade: true }))
    //.pipe(cssnano({ autoprefixer: false, zindex: false, reduceIdents: false, colormin: false, discardUnused: false }))
    .pipe(gulp.dest(`${paths.src.assets}css/`));
}


/* Compiling JS */

/* Compiling core scripts once before 'watch' or 'build' into src/assets/js/** */

function jsCore() {
  return gulp
    .src([`${paths.src.__core}__core-js/*.js`])
    .pipe(babel())
    .pipe(gulp.dest(`${paths.src.assets}js/`));
}


/* Compiling custom scripts ON 'watch' or 'build' into src/assets/js/** */

function jsCustom() {

  /* Compiling components.min.js from separate js-files */

  const jsComponentsBundle = gulp
    .src([`${paths.src.components}**/*.js`, `!${paths.src.components}**/%*.js`])
    .pipe(sourcemaps.init({largeFile: true}))
    .pipe(concat('components.js'))
    .pipe(header('window.addEventListener(\'DOMContentLoaded\', function() {'))
    .pipe(footer('});'))
    .pipe(babel())
    .pipe(sourcemaps.write('/maps'))
    .pipe(gulp.dest(`${paths.src.assets}js/`));


  /* Get separate js-files, marked with % */

  const jsComponentsSeparate = gulp
    .src([`${paths.src.components}**/%*.js`])
    .pipe(rename(function(path) {
      path.dirname  = 'components/';
      path.basename = path.basename.replace('%', '');
      path.basename += ".min";
    }))
    .pipe(babel())
    .pipe(gulp.dest(`${paths.src.assets}js/`));


  return merge(jsComponentsBundle, jsComponentsSeparate);

}


/* Creating SVG-sprite from all .svg files in src/assets/img/icons/src */

function svgIconsSprite() {
  return gulp
  .src([`${paths.src.assets}img/icons/src/*.svg`])
  .pipe(plumber({ handleError(err) { console.log(err); this.emit('end'); } }))
  .pipe(svgmin({ js2svg: { pretty: true } }))
  .pipe(cheerio({
    run($) {
      $('[fill]').removeAttr('fill');
      $('[stroke]').removeAttr('stroke');
      $('[style]').removeAttr('style');
      $('style').remove();
    },
    parserOptions: { xmlMode: true },
  }))
  .pipe(replace('&gt;', '>'))
  .pipe(svgSprite({ mode: { symbol: { sprite: '../sprite.svg' } } }))
  .pipe(gulp.dest([`${paths.src.assets}img/icons/`]));
}


/* Clean build folder before build task */

function clean() {
  return del(`${paths.build}**/*.*`);
}


/* Tasks for build */

function buildHtml() {
  /* Update css and js import right into src/*.html */

  return gulp
    .src(['src/*.html'])
    .pipe(htmlMin({ collapseWhitespace: true }))
    .pipe(replace(
      /<!-- inject:css -->(.*)(.css">)<!-- endinject -->/g,
      '<link rel="stylesheet" href="assets/css/libs.min.css">\r\n<link rel="stylesheet" href="assets/css/style.min.css">',
    ))
    .pipe(replace(
      /<!-- inject:js -->(.*)<!-- endinject -->/g,
      '<script src="assets/js/libs.min.js"></script>\r\n<script src="assets/js/common.min.js"></script>\r\n<script src="assets/js/components.min.js"></script>',
    ))
    .pipe(prettyHtml({ indent_size: 4, end_with_newline: true }))
    .pipe(gulp.dest(paths.build));
}


function buildCss() {

  /* Compile all css libs into one */

  const buildCssLibs = gulp
    .src([`${paths.src.assets}css/libs/**/*.css`])
    .pipe(concat('libs.min.css'))
    .pipe(cssnano({ autoprefixer: false, zindex: false, reduceIdents: false, discardUnused: false }))
    .pipe(gulp.dest(`${paths.build}assets/css/`));


  /* Build color-vars.min.css and common.min.css into one */

  const buildCssCommon = gulp
    //.src([`${paths.src.assets}css/common.css`, `${paths.src.assets}css/custom.css`])
    .src(`${paths.src.assets}css/style.css`)
    //.pipe(concat('common.min.css'))
    .pipe(rename({ suffix: '.min' }))
    .pipe(cssnano({ autoprefixer: false, zindex: false, reduceIdents: false, discardUnused: false }))
    .pipe(gulp.dest(`${paths.build}assets/css/`));


  /* Move separate css files but layout-helpers */

  const buildCssSeparate = gulp
    //.src([`${paths.src.assets}css/**/*.css`, `!${paths.src.assets}css/libs/*.css`, `!${paths.src.assets}css/common.css`, `!${paths.src.assets}css/custom.css`, `!${paths.src.assets}css/layout-helpers.css`])
    .src([`${paths.src.assets}css/**/*.css`, `!${paths.src.assets}css/libs/*.css`, `!${paths.src.assets}css/style.css`, `!${paths.src.assets}css/layout-helpers.css`])
    .pipe(rename({ suffix: '.min' }))
    .pipe(cssnano({ autoprefixer: false, zindex: false, reduceIdents: false, discardUnused: false }))
    .pipe(gulp.dest(`${paths.build}assets/css/`));

  return merge(buildCssLibs, buildCssCommon, buildCssSeparate);
}


function buildFonts() {
  /* Moving fonts */

  return gulp
    .src([`${paths.src.assets}fonts/**/*.*`])
    .pipe(gulp.dest(`${paths.build}assets/fonts/`));
}


function buildImg() {
  /* Moving images */

  return gulp
    .src([`${paths.src.assets}img/**/*.*`])
    .pipe(gulp.dest(`${paths.build}assets/img/`));
}


function buildJs() {
  /* Compile all js libs into one */

  const buildJsLibs = gulp
    .src([`${paths.src.__core}__core-js/__libs/*.js`, `${paths.src.assets}js/libs/**/*.js`])
    .pipe(concat('libs.min.js'))
    .pipe(gulp.dest(`${paths.build}assets/js/`));


  /* Compile common.js */

  const buildJsCommon = gulp
    .src([`${paths.src.__core}__core-js/common.js`, `${paths.src.assets}js/components.js`], { allowEmpty: true })
    .pipe(rename({ suffix: '.min' }))
    .pipe(babel())
    .pipe(uglify())
    .pipe(gulp.dest(`${paths.build}assets/js/`));


  /* Compile separate components (everything but libs) */

  const buildJsComponents = gulp
    .src([`${paths.src.assets}js/components/*.js`])
    .pipe(babel())
    .pipe(uglify())
    .pipe(gulp.dest(`${paths.build}assets/js/components`));

  return merge(buildJsLibs, buildJsCommon, buildJsComponents);
}


/* Preparing whole src folder before watch or build */

//const srcPrepare = gulp.series(layoutHelpers, cssCore, cssCustom, jsCore, jsCustom, html, svgIconsSprite);
const srcPrepare = gulp.series(layoutHelpers, cssCore, jsCore, jsCustom, html, svgIconsSprite);

/* Watcher */

function watchFiles() {

  /* Watch twig inserts to recompile all the pages */
  gulp.watch(['src/{components,includes,layouts}/**/*.twig'], gulp.series(htmlInserts, browserSyncReload));

  /* Watch pages only to recompile only updated */
  gulp.watch(['src/pages/**/*.twig'], gulp.series(htmlPages, browserSyncReload));

  /* Watch common Sass */
  //gulp.watch([`${paths.src.__core}__core-scss/**/*.scss`, `!${paths.src.__core}__core-scss/custom.scss`], gulp.series(cssCore, browserSyncReload));

  /* Watch custom Sass */
  gulp.watch(['src/{components,layouts,pages}/**/*.scss'], gulp.series(cssCore, browserSyncReload));

  /* Watch custom JS */
  gulp.watch([`${paths.src.components}**/*.js`], gulp.series(jsCustom, browserSyncReload));

  /* Watch SVG-icons to recompile sprite */
  gulp.watch([`${paths.src.assets}img/icons/src/*.svg`], gulp.series(svgIconsSprite, browserSyncReload));

}


/* Watcher and builder series */

const watch = gulp.series(srcPrepare, gulp.parallel(watchFiles, browserSyncInit));
const build = gulp.series(clean, srcPrepare, gulp.parallel(buildHtml, buildCss, buildFonts, buildImg, buildJs));


/* Available tasks from command line */

exports.default   = watch;
exports.watch     = watch;
exports.build     = build;
exports.runbuild  = runbuild;
