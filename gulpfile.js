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

// babel
gulp.task('babel', function () {
  return gulp.src('src/**/*.es6')
    .pipe(plumber({
      errorHandler: notify.onError("Error: <%= error.message %>")
    }))
    .pipe(babel())
    // .pipe(uglify())
    .pipe(gulp.dest('./dest'));
});

// html
gulp.task('html', function () {
  return gulp.src('src/**/*.{html,ejs}')
    .pipe(gulp.dest('./dest'));
});

// watch
gulp.task('watch', function() {
  gulp.watch('src/**/*.es6', ['babel'])
  gulp.watch('src/**/*.{html,ejs}', ['html'])
});

// defautl
gulp.task('default', ['clean', 'babel', 'html', 'watch']);
