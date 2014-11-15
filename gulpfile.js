var gulp            = require("gulp"),
    gulp_zip        = require("gulp-zip");

gulp.task("default", function() {
    return gulp.src("src/**")
          .pipe(gulp_zip("package.zip"))
          .pipe(gulp.dest("dist"));
});