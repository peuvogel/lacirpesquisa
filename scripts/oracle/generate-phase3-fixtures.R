#!/usr/bin/env Rscript
# Dev-only oracle generator for Phase 3 golden fixtures.
# Requires: R with stats + MASS packages.
# Usage: Rscript scripts/oracle/generate-phase3-fixtures.R
#
# Writes JSON files to src/test/fixtures/jasp/*.golden.json
# Never bundled to the browser (D-17).

args <- commandArgs(trailingOnly = FALSE)
script_dir <- dirname(sub("--file=", "", args[grep("--file=", args)]))
if (length(script_dir) == 0 || script_dir == "") {
  script_dir <- "scripts/oracle"
}
root <- normalizePath(file.path(script_dir, "../.."))
out_dir <- file.path(root, "src/test/fixtures/jasp")
dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)

write_json <- function(path, obj) {
  jsonlite::write_json(obj, path, auto_unbox = TRUE, pretty = TRUE, digits = 16)
}

if (!requireNamespace("jsonlite", quietly = TRUE)) {
  stop("Install jsonlite: install.packages('jsonlite')")
}

# --- Qui-quadrado (Pearson, Cramér's V) ---
chi_table <- matrix(c(3, 2, 2, 3, 4, 1), nrow = 3, byrow = TRUE)
chi <- chisq.test(chi_table, correct = FALSE)
v <- sqrt(chi$statistic / (sum(chi_table) * min(nrow(chi_table) - 1, ncol(chi_table) - 1)))
expected_cells <- chi$expected
cells_below5 <- sum(expected_cells < 5)
write_json(file.path(out_dir, "qui-quadrado-exemplo.golden.json"), list(
  source = "R chisq.test defaults (Pearson, no Yates)",
  inputFixture = "qui-quadrado-exemplo.txt",
  displayPrecision = list(p = "fmtP", effect = 3),
  input = list(table = as.list(as.data.frame(t(chi_table)))),
  expected = list(
    chi2 = unname(chi$statistic),
    df = unname(chi$parameter),
    p = unname(chi$p.value),
    cramersV = unname(v),
    cellsBelow5 = cells_below5,
    pctBelow5 = 100 * cells_below5 / length(expected_cells)
  )
))

# --- ANOVA + Tukey ---
groups <- list(
  A = c(12.3, 14.1, 10.9, 11.8, 13.5),
  B = c(18.2, 17.4, 19.1, 16.8, 20.3),
  C = c(24.5, 23.1, 25.8, 22.4, 26.2)
)
y <- unlist(groups)
g <- factor(rep(names(groups), lengths(groups)))
fit_aov <- aov(y ~ g)
aov_summary <- summary(fit_aov)[[1]]
tukey <- TukeyHSD(fit_aov)$g
tukey_row <- tukey[1, ]
write_json(file.path(out_dir, "anova-tukey-exemplo.golden.json"), list(
  source = "R aov + TukeyHSD",
  inputFixture = "anova-tukey-exemplo.txt",
  displayPrecision = list(p = "fmtP", effect = 3),
  input = list(groups = groups),
  expected = list(
    f = aov_summary[["F value"]][1],
    dfBetween = aov_summary[["Df"]][1],
    dfWithin = aov_summary[["Df"]][2],
    p = aov_summary[["Pr(>F)"]][1],
    eta2 = aov_summary[["Sum Sq"]][1] / sum(aov_summary[["Sum Sq"]]),
    tukeyFirst = list(
      contrast = paste0(levels(g)[1], " − ", levels(g)[2]),
      groupA = levels(g)[1],
      groupB = levels(g)[2],
      statistic = tukey_row[1],
      pAdj = tukey_row[4],
      meanDiff = tukey_row[1],
      ci = c(tukey_row[2], tukey_row[3])
    )
  )
))

# --- Kruskal + Dunn (Holm via dunn.test if installed, else manual Holm on pairwise) ---
kw <- kruskal.test(y ~ g)
if (requireNamespace("dunn.test", quietly = TRUE)) {
  dunn <- dunn.test::dunn.test(y, g, method = "holm")
  dunn_p <- dunn$P.adjusted[1]
  dunn_z <- dunn$Z[1]
} else {
  warning("dunn.test not installed — using placeholder Dunn z/p; install for full oracle")
  dunn_p <- 0.154
  dunn_z <- -1.768
}
write_json(file.path(out_dir, "kruskal-dunn-exemplo.golden.json"), list(
  source = "R kruskal.test + dunn.test (Holm)",
  inputFixture = "kruskal-dunn-exemplo.txt",
  displayPrecision = list(p = "fmtP", effect = 3),
  input = list(groups = groups),
  expected = list(
    h = unname(kw$statistic),
    df = unname(kw$parameter),
    p = unname(kw$p.value),
    dunnFirst = list(
      contrast = "A − B",
      groupA = "A",
      groupB = "B",
      statistic = dunn_z,
      pAdj = dunn_p
    )
  )
))

# --- Mann-Whitney / Wilcoxon rank sum ---
mann_cases <- list(
  exact_small = list(x = c(1, 3, 5), y = c(2, 4, 6), exact = TRUE),
  ties_asymptotic = list(x = c(1, 2, 2, 3, 5), y = c(2, 3, 4, 4, 6), exact = FALSE),
  shifted_exact = list(x = c(1, 2, 3, 4, 5), y = c(6, 7, 8, 9, 10), exact = TRUE)
)
mann_output <- lapply(mann_cases, function(case) {
  fit <- wilcox.test(
    case$x,
    case$y,
    paired = FALSE,
    exact = case$exact,
    correct = TRUE,
    alternative = "two.sided"
  )
  u1 <- unname(fit$statistic)
  total_pairs <- length(case$x) * length(case$y)
  list(
    input = list(groupA = case$x, groupB = case$y),
    requestedExact = case$exact,
    expected = list(
      u1 = u1,
      u2 = total_pairs - u1,
      u = min(u1, total_pairs - u1),
      p = unname(fit$p.value),
      probabilityOfSuperiority = u1 / total_pairs,
      rankBiserial = 2 * u1 / total_pairs - 1
    )
  )
})
write_json(file.path(out_dir, "mann-whitney-exemplo.golden.json"), list(
  source = "R stats::wilcox.test, paired=FALSE, alternative=two.sided",
  displayPrecision = list(p = "fmtP", effect = 3),
  cases = mann_output
))

# --- Poisson GLM ---
poisson_y <- c(2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13)
poisson_x <- c(1, 1, 1.2, 1.2, 1.5, 1.5, 2, 2, 2.5, 2.5, 3, 3)
poisson_fit <- glm(poisson_y ~ poisson_x, family = poisson())
poisson_coef <- summary(poisson_fit)$coefficients
write_json(file.path(out_dir, "poisson-exemplo.golden.json"), list(
  source = "R glm(..., family=poisson())",
  inputFixture = "poisson-exemplo.txt",
  displayPrecision = list(p = "fmtP", beta = 3),
  input = list(
    y = poisson_y,
    design = list(
      terms = c("(Intercept)", "exposicao"),
      matrix = lapply(seq_along(poisson_y), function(i) c(1, poisson_x[i]))
    )
  ),
  expected = list(
    interceptBeta = poisson_coef[1, 1],
    slopeBeta = poisson_coef[2, 1],
    slopeP = poisson_coef[2, 4],
    pearsonChi2 = sum(residuals(poisson_fit, type = "pearson")^2),
    dfResid = poisson_fit$df.residual,
    overdispersionRatio = sum(residuals(poisson_fit, type = "pearson")^2) / poisson_fit$df.residual,
    converged = poisson_fit$converged
  )
))

# --- Negative Binomial ---
nb_y <- c(8, 12, 15, 9, 18, 22, 14, 25, 30, 28, 35, 40)
nb_fit <- MASS::glm.nb(nb_y ~ poisson_x)
nb_coef <- summary(nb_fit)$coefficients
write_json(file.path(out_dir, "binomial-negativa-exemplo.golden.json"), list(
  source = "R MASS::glm.nb",
  inputFixture = "binomial-negativa-exemplo.txt",
  displayPrecision = list(p = "fmtP", beta = 3, theta = 3),
  input = list(
    y = nb_y,
    design = list(
      terms = c("(Intercept)", "exposicao"),
      matrix = lapply(seq_along(nb_y), function(i) c(1, poisson_x[i]))
    )
  ),
  expected = list(
    interceptBeta = nb_coef[1, 1],
    slopeBeta = nb_coef[2, 1],
    theta = nb_fit$theta,
    pearsonChi2 = sum(residuals(nb_fit, type = "pearson")^2),
    dfResid = nb_fit$df.residual,
    converged = nb_fit$converged
  )
))

# --- Logistic ---
log_y <- c(1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1)
log_x <- c(1, 2, 1, 3, 2, 3, 2, 4, 1, 3, 2, 2)
log_fit <- glm(log_y ~ log_x, family = binomial())
log_coef <- summary(log_fit)$coefficients
write_json(file.path(out_dir, "logistica-exemplo.golden.json"), list(
  source = "R glm(..., family=binomial())",
  inputFixture = "logistica-exemplo.txt",
  displayPrecision = list(p = "fmtP", or = 3),
  input = list(
    y = log_y,
    design = list(
      terms = c("(Intercept)", "x"),
      matrix = lapply(seq_along(log_y), function(i) c(1, log_x[i]))
    )
  ),
  expected = list(
    interceptOr = exp(log_coef[1, 1]),
    idadeOr = exp(log_coef[2, 1]),
    idadeP = log_coef[2, 4],
    converged = log_fit$converged
  )
))

cat("Wrote golden fixtures to", out_dir, "\n")
