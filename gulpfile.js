var gulp = require('gulp'),
    plumber = require('gulp-plumber'),
    notify = require("gulp-notify"),
    babel = require('gulp-babel'),
    uglify = require("gulp-uglify"),
    del = require('del');
;

// clean
gulp.task('clean', function(cb) {
  del(['**/*.wav'], cb);
});

// main
gulp.task('main', function () {
      return gulp.src('src/**/*.es6')
        .pipe(plumber({
          errorHandler: notify.onError("Error: <%= error.message %>")
        }))
        .pipe(babel())
        .pipe(uglify())
        .pipe(gulp.dest('./'));
});

// watch
gulp.task('watch', function() {
  gulp.watch('src/**/*.es6', ['main'])
});

// defautl
gulp.task('default', ['clean', 'main', 'watch']);
