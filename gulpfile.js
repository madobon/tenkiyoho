var gulp = require('gulp'),
    plumber = require('gulp-plumber'),
    notify = require("gulp-notify"),
    babel = require('gulp-babel'),
    del = require('del');
;

// clean
gulp.task('clean', function(cb) {
  del(['**/*.wav'], cb);
});

// babel
gulp.task('babel', function () {
      return gulp.src('src/**/*.es6')
        .pipe(plumber({
          errorHandler: notify.onError("Error: <%= error.message %>")
        }))
        .pipe(babel())
        .pipe(gulp.dest('./'));
});

// watch
gulp.task('watch', function() {
  gulp.watch('src/**/*.es6', ['babel'])
});

// defautl
gulp.task('default', ['clean', 'babel', 'watch']);
