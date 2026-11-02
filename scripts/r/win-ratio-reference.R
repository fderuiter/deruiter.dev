# Independent reference values for the win-ratio engine
# (lib/study-data/internal/tlf/win-ratio.ts).
#
# Generates seeded synthetic fixtures, runs them through the CRAN package
# WINS (win.stat, Dong et al.), computes the Finkelstein-Schoenfeld test
# with a separate R implementation written from the 1999 paper, and writes
# one JSON file per fixture to __tests__/fixtures/study-data/win-ratio/.
# __tests__/study-data-win-ratio.test.ts reads those files; R is needed
# only to refresh them, never to run the tests.
#
# Usage, from the repository root:
#   Rscript scripts/r/win-ratio-reference.R
# The device fixture (#3424) also needs its input, written first by
#   npx tsx scripts/win-ratio-device-input.ts
# Requires R >= 4.3 and the packages WINS (>= 1.5.1) and jsonlite.

suppressPackageStartupMessages({
  library(WINS)
  library(jsonlite)
})

out_dir <- file.path("__tests__", "fixtures", "study-data", "win-ratio")
dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)

# Components: kind is "tte", "continuous" or "binary"; better is "larger"
# or "smaller" in WINS terms; margin is WINS's tau; horizon applies to
# time-to-event components only.
make_fixture <- function(seed, n_trt, n_con, strata, components) {
  set.seed(seed)
  n <- n_trt + n_con
  arm <- c(rep(1, n_trt), rep(2, n_con))
  stratum <- sample(seq_along(strata), n, replace = TRUE)
  cols <- list()
  # One censoring time per subject, shared by every time-to-event component.
  tte <- Filter(function(comp) comp$kind == "tte", components)
  censor_time <- if (length(tte) > 0) ceiling(runif(n, tte[[1]]$follow_up[1], tte[[1]]$follow_up[2])) else NULL
  for (k in seq_along(components)) {
    comp <- components[[k]]
    shift <- ifelse(arm == 1, comp$effect, 0)
    if (comp$kind == "tte") {
      event_time <- ceiling(rexp(n, rate = comp$rate * exp(-shift)))
      cols[[paste0("Y_", k)]] <- pmin(event_time, censor_time)
      cols[[paste0("Delta_", k)]] <- as.integer(event_time <= censor_time)
    } else if (comp$kind == "continuous") {
      cols[[paste0("Y_", k)]] <- round(rnorm(n, comp$mean + shift, comp$sd), comp$digits)
    } else {
      cols[[paste0("Y_", k)]] <- rbinom(n, 1, plogis(qlogis(comp$p) + shift))
    }
  }
  data <- data.frame(id = seq_len(n), arm = arm, stratum = stratum)
  for (name in names(cols)) data[[name]] <- cols[[name]]
  data
}

# Finkelstein-Schoenfeld: score every pair of the pooled stratum through
# the hierarchy (+1 better, -1 worse, 0 tie), sum per subject, and refer
# the treatment total to its permutation variance
# n_t n_c / (n (n - 1)) * sum(U_i^2).
fs_better <- function(a, b, components, data) {
  for (k in seq_along(components)) {
    comp <- components[[k]]
    ya <- data[[paste0("Y_", k)]][a]
    yb <- data[[paste0("Y_", k)]][b]
    m <- if (comp$kind == "binary") 0 else comp$margin
    # A missing value ties with every value on that component.
    if (is.na(ya) || is.na(yb)) next
    if (comp$kind == "tte") {
      h <- if (is.null(comp$horizon)) Inf else comp$horizon
      ea <- data[[paste0("Delta_", k)]][a] == 1
      eb <- data[[paste0("Delta_", k)]][b] == 1
      if (ya > h) { ya <- h; ea <- FALSE }
      if (yb > h) { yb <- h; eb <- FALSE }
      if (comp$better == "larger") {
        if (eb && ya > yb + m) return(1)
        if (ea && yb > ya + m) return(-1)
      } else {
        if (ea && ya < yb - m) return(1)
        if (eb && yb < ya - m) return(-1)
      }
    } else if (comp$better == "larger") {
      if (ya > yb + m) return(1)
      if (yb > ya + m) return(-1)
    } else {
      if (ya < yb - m) return(1)
      if (yb < ya - m) return(-1)
    }
  }
  0
}

fs_test <- function(data, components, stratified) {
  groups <- if (stratified) split(seq_len(nrow(data)), data$stratum) else list(seq_len(nrow(data)))
  statistic <- 0
  variance <- 0
  for (idx in groups) {
    n <- length(idx)
    u <- numeric(n)
    for (a in seq_len(n - 1)) for (b in (a + 1):n) {
      s <- fs_better(idx[a], idx[b], components, data)
      u[a] <- u[a] + s
      u[b] <- u[b] - s
    }
    n_t <- sum(data$arm[idx] == 1)
    n_c <- n - n_t
    statistic <- statistic + sum(u[data$arm[idx] == 1])
    variance <- variance + n_t * n_c / (n * (n - 1)) * sum(u^2)
  }
  z <- statistic / sqrt(variance)
  list(statistic = statistic, variance = variance, z = z,
       p_two_sided = 2 * pnorm(-abs(z)))
}

run_fixture <- function(name, data, components, weighting, alpha = 0.05) {
  ep_type <- vapply(components, function(c) c$kind, "")
  horizon <- min(vapply(components, function(c) if (c$kind == "tte") c$horizon else Inf, 0))
  wins_data <- data[, c("arm", "id", "stratum",
                        grep("^Delta_", names(data), value = TRUE),
                        grep("^Y_", names(data), value = TRUE))]
  res <- win.stat(
    data = wins_data, ep_type = ep_type, arm.name = c(1, 2),
    priority = seq_along(components),
    tau = vapply(components, function(c) c$margin, 0),
    np_direction = vapply(components, function(c) c$better, ""),
    horizon = horizon, alpha = alpha, digit = 10,
    pvalue = "two-sided", stratum.weight = weighting,
    method = "unadjusted", summary.print = FALSE
  )
  stratified <- weighting != "unstratified"
  fs <- fs_test(data, components, stratified)
  per_endpoint <- lapply(seq_along(components), function(k) {
    trt <- res$summary_ep[[paste0("Trt_Endpoint", k)]]
    con <- res$summary_ep[[paste0("Con_Endpoint", k)]]
    list(wins = sum(trt$Count), losses = sum(con$Count))
  })
  list(
    name = name,
    generator = "scripts/r/win-ratio-reference.R",
    reference = list(
      r = R.version.string,
      wins = as.character(packageVersion("WINS")),
      method = "WINS::win.stat, method = 'unadjusted'; Finkelstein-Schoenfeld in this script"
    ),
    settings = list(weighting = weighting, alpha = alpha, sided = "two-sided"),
    components = lapply(components, function(c) list(
      kind = c$kind, better = c$better, margin = c$margin,
      horizon = if (c$kind == "tte") c$horizon else NULL
    )),
    subjects = lapply(seq_len(nrow(data)), function(i) list(
      id = data$id[i], arm = data$arm[i], stratum = data$stratum[i],
      values = I(unname(vapply(seq_along(components), function(k) data[[paste0("Y_", k)]][i], 0))),
      events = I(unname(vapply(seq_along(components), function(k) {
        col <- paste0("Delta_", k)
        if (col %in% names(data)) data[[col]][i] else NA_real_
      }, 0)))
    )),
    expected = list(
      per_endpoint = per_endpoint,
      win_ratio = as.list(res$Win_statistic$Win_Ratio),
      net_benefit = as.list(res$Win_statistic$Net_Benefit),
      win_odds = as.list(res$Win_statistic$Win_Odds),
      z = as.list(res$z_statistic[1, ]),
      p = as.list(res$p_value[1, ]),
      finkelstein_schoenfeld = fs
    )
  )
}

write_fixture <- function(fixture) {
  path <- file.path(out_dir, paste0(fixture$name, ".json"))
  write(toJSON(fixture, auto_unbox = TRUE, digits = I(17), pretty = TRUE, null = "null", na = "null"), path)
  message("wrote ", path)
}

# Fixture 1: the cardiovascular hierarchy. Death and hospitalisation as
# times to an event over a 365-day horizon, then a quality-of-life change
# with a 5-point margin. Unstratified.
cv_components <- list(
  list(kind = "tte", better = "larger", margin = 0, horizon = 365,
       rate = 1 / 900, effect = 0.3, follow_up = c(200, 420)),
  list(kind = "tte", better = "larger", margin = 0, horizon = 365,
       rate = 1 / 500, effect = 0.25, follow_up = c(200, 420)),
  list(kind = "continuous", better = "larger", margin = 5,
       mean = 8, sd = 18, digits = 0, effect = 4)
)
cv <- make_fixture(301, 70, 65, c("A", "B", "C"), cv_components)
# Death censors the later components: no hospitalisation after death, and
# the quality-of-life change is unobserved, so it is set to the worst value.
died <- cv$Delta_1 == 1
hosp_first <- cv$Delta_2 == 1 & cv$Y_2 < cv$Y_1
cv$Delta_2 <- ifelse(died & !hosp_first, 0L, cv$Delta_2)
cv$Y_2 <- ifelse(died & !hosp_first, cv$Y_1, cv$Y_2)
cv$Y_3 <- ifelse(died, -100, cv$Y_3)
write_fixture(run_fixture("cv-unstratified", cv, cv_components, "unstratified"))

# Fixture 2: the same data, stratified by the three strata, both weightings.
write_fixture(run_fixture("cv-stratified-mh", cv, cv_components, "MH-type"))
write_fixture(run_fixture("cv-stratified-equal", cv, cv_components, "equal"))

# Fixture 3: a fixed-window drug hierarchy with no censoring: a binary
# serious-event indicator (0 is better), rescue medication (0 is better),
# then systolic blood pressure change, lower is better, 5 mmHg margin.
bp_components <- list(
  list(kind = "binary", better = "smaller", margin = 0, p = 0.12, effect = -0.4),
  list(kind = "binary", better = "smaller", margin = 0, p = 0.2, effect = -0.5),
  list(kind = "continuous", better = "smaller", margin = 5,
       mean = -6, sd = 11, digits = 1, effect = -5)
)
bp <- make_fixture(17, 48, 52, c("A", "B"), bp_components)
write_fixture(run_fixture("bp-fixed-window", bp, bp_components, "unstratified", alpha = 0.1))

# Fixture 4: an earlier event is better (time to recovery), with a margin
# of 2 days on the event times and a 60-day horizon.
rec_components <- list(
  list(kind = "tte", better = "smaller", margin = 2, horizon = 60,
       rate = 1 / 20, effect = 0.35, follow_up = c(30, 80))
)
rec <- make_fixture(5, 40, 40, c("A"), rec_components)
write_fixture(run_fixture("recovery-earlier-better", rec, rec_components, "unstratified"))

# Fixture 5: the seeded TAVR versus SAVR study (#3424). The subjects are
# the study's Full Analysis Set as ADSL and ADHCE record them, written by
# scripts/win-ratio-device-input.ts: death, disabling stroke and
# rehospitalisation as times to an event, then the 1-year VSFS change with
# a 5-point margin, stratified by surgical risk with MH-type weights.
#
# A subject without a 1-year score ties with everyone on that component.
# WINS removes any subject with a missing value instead, so the missing
# scores are passed as a sentinel and a strategy that ties any pair
# holding it; every other comparison is WINS's default strategy.
MISSING <- -1e6
tie_missing <- function(trt_con, priority, tau, np_direction, ...) {
  for (l in priority) {
    yt <- paste0("Y_", l, "_trt")
    yc <- paste0("Y_", l, "_con")
    gone <- trt_con[, yt] == MISSING | trt_con[, yc] == MISSING
    trt_con[gone, yt] <- 0
    trt_con[gone, yc] <- 0
  }
  WINS:::win.strategy.default(trt_con = trt_con, priority = priority,
                              tau = tau, np_direction = np_direction)
}

# Pairs, wins, losses and ties of each stratum, counted pair by pair with
# fs_better, independently of WINS.
stratum_counts <- function(data, components) {
  lapply(sort(unique(data$stratum)), function(k) {
    trt <- which(data$stratum == k & data$arm == 1)
    con <- which(data$stratum == k & data$arm == 2)
    wins <- 0
    losses <- 0
    for (a in trt) for (b in con) {
      s <- fs_better(a, b, components, data)
      if (s > 0) wins <- wins + 1
      if (s < 0) losses <- losses + 1
    }
    pairs <- length(trt) * length(con)
    list(stratum = k, treatment = length(trt), control = length(con),
         pairs = pairs, wins = wins, losses = losses,
         ties = pairs - wins - losses)
  })
}

device_dir <- file.path("__tests__", "fixtures", "study-data", "win-ratio-device")
device_input <- file.path(device_dir, "tavr-savr-input.json")
if (file.exists(device_input)) {
  input <- fromJSON(device_input, simplifyVector = FALSE)
  components <- lapply(input$components, function(c) list(
    kind = c$kind, better = c$better, margin = c$margin, horizon = NULL
  ))
  data <- data.frame(
    id = vapply(input$subjects, function(s) s$id, 0),
    arm = vapply(input$subjects, function(s) s$arm, 0),
    stratum = vapply(input$subjects, function(s) s$stratum, 0)
  )
  for (k in seq_along(components)) {
    data[[paste0("Y_", k)]] <- vapply(input$subjects, function(s) {
      v <- s$values[[k]]
      if (is.null(v)) NA_real_ else v
    }, 0)
    if (components[[k]]$kind == "tte") {
      data[[paste0("Delta_", k)]] <- vapply(input$subjects, function(s) s$events[[k]], 0)
    }
  }
  wins_data <- data[, c("arm", "id", "stratum",
                        grep("^Delta_", names(data), value = TRUE),
                        grep("^Y_", names(data), value = TRUE))]
  for (k in seq_along(components)) {
    col <- paste0("Y_", k)
    wins_data[[col]][is.na(wins_data[[col]])] <- MISSING
  }
  res <- win.stat(
    data = wins_data, ep_type = vapply(components, function(c) c$kind, ""),
    arm.name = c(1, 2), priority = seq_along(components),
    tau = vapply(components, function(c) c$margin, 0),
    np_direction = vapply(components, function(c) c$better, ""),
    horizon = Inf, alpha = input$settings$alpha, digit = 10,
    pvalue = "two-sided", stratum.weight = input$settings$weighting,
    method = "unadjusted", win.strategy = tie_missing, summary.print = FALSE
  )
  per_endpoint <- lapply(seq_along(components), function(k) {
    trt <- res$summary_ep[[paste0("Trt_Endpoint", k)]]
    con <- res$summary_ep[[paste0("Con_Endpoint", k)]]
    list(wins = sum(trt$Count), losses = sum(con$Count))
  })
  strata <- stratum_counts(data, components)
  # The pair-by-pair counts and WINS must agree before anything is written.
  stopifnot(
    sum(vapply(strata, function(s) s$wins, 0)) ==
      sum(vapply(per_endpoint, function(e) e$wins, 0)),
    sum(vapply(strata, function(s) s$losses, 0)) ==
      sum(vapply(per_endpoint, function(e) e$losses, 0))
  )
  fixture <- list(
    name = input$name,
    generator = "scripts/r/win-ratio-reference.R",
    input = "tavr-savr-input.json",
    reference = list(
      r = R.version.string,
      wins = as.character(packageVersion("WINS")),
      method = "WINS::win.stat, method = 'unadjusted', stratum.weight = 'MH-type', a missing value tied by a custom win.strategy; Finkelstein-Schoenfeld and per-stratum counts in this script"
    ),
    settings = input$settings,
    expected = list(
      per_endpoint = per_endpoint,
      strata = strata,
      win_ratio = as.list(res$Win_statistic$Win_Ratio),
      net_benefit = as.list(res$Win_statistic$Net_Benefit),
      win_odds = as.list(res$Win_statistic$Win_Odds),
      z = as.list(res$z_statistic[1, ]),
      p = as.list(res$p_value[1, ]),
      finkelstein_schoenfeld = fs_test(data, components, TRUE)
    )
  )
  path <- file.path(device_dir, "tavr-savr-stratified-mh.json")
  write(toJSON(fixture, auto_unbox = TRUE, digits = I(17), pretty = TRUE, null = "null", na = "null"), path)
  message("wrote ", path)
}
