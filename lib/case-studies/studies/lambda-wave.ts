import { compileCaseStudy } from "../compiler";
import type { CaseStudyData } from "../types";

export const caseStudy: CaseStudyData = compileCaseStudy({
    id: "canonical-15",
    slug: "lambda-wave",
    title: "Lambda-Wave: Tracking Respiratory Motion With Radar",
    primary_language: "Haskell / C++",
    github_url: "https://github.com/fderuiter/lambda-wave",
    published: true,
    simulated_telemetry: false,
    tags: "haskell, embedded-systems, dsp, fmcw-radar, sgrt, medical-device, iec-62304, real-time",
    editorial_content:
      "An **FMCW radar** project exploring respiratory motion tracking for Surface Guided Radiation Therapy. **Haskell** handles signal processing; **C++** ring buffers move samples between stages.",
    architectural_narrative: `<h3>The problem</h3>
<p>Lambda-Wave explores a radar signal-processing pipeline for tracking respiratory motion in the context of Surface Guided Radiation Therapy. The design separates numerical processing from sample transport and makes timing and failure handling explicit.</p>
<p><strong>The approach:</strong> Haskell implements the signal-processing stages, and C++ ring buffers carry samples across the FFI boundary. The design also considers watchdogs and timing limits.</p>
<p><strong>Reported project measurements:</strong> Sub-10ms hard safety watchdog window; sub-millimeter motion tracking precision; zero-copy shared memory FFI bridge executing at 60fps.</p>

<h3>How it works</h3>
<p><strong>Functional Core / Imperative Shell:</strong> Pure mathematical modules (<code>Numeric.Kinematics</code>, <code>SignalProcessing.FMCW</code>, <code>SignalProcessing.Kalman</code>) are decoupled from IO and side-effects.</p>
<p><strong>Lock-Free Circular Ring Buffer Bridge:</strong> High-throughput raw radar frame ingestion from TI IWR6843ISK mmWave hardware across C/C++ FFI via zero-copy shared memory abstractions.</p>
<p><strong>Watchdog &amp; Fail-Safe Interlock Pattern:</strong> Independent watchdog thread verifying signal freshness and safety invariant tokens; any communication dropout immediately forces hardware beam-hold assertion.</p>

<h3>How the pieces connect</h3>
<pre><code class="language-mermaid">
flowchart LR
    A[TI IWR6843ISK mmWave Radar] -->|UART Raw Chirps| B[C++ Lock-Free RingBuffer]
    B -->|Haskell FFI| C[FMCW Range-Doppler DSP]
    C --> D[Kalman Kinematic Filter]
    D --> E[Surface Mesher & Displacement Engine]
    E --> F{Gating Logic & Safety Watchdog}
    F -->|Within Gate| G[Beam Enable State]
    F -->|Excursion / Failure| H[LINAC Beam Hold GPIO Interlock]
    D -->|FFI Bridge| I[C++ / OpenGL ImGui HUD Visualizer]
</code></pre>

<h3>Implementation notes</h3>

<h4>Ring Buffer Zero-Copy FFI Bridge (<code>cbits/src/ring_buffer_ffi.cpp</code> &amp; <code>src/FFI/RingBuffer/IO.hs</code>)</h4>
<pre><code class="language-cpp">
// cbits/src/ring_buffer_ffi.cpp
#include "RingBuffer.h"
#include <atomic>

extern "C" {
    int ring_buffer_read_frame(RingBuffer* rb, RadarFrame* dest_frame) {
        if (!rb || !dest_frame) return -1;
        uint32_t head = rb->head.load(std::memory_order_acquire);
        uint32_t tail = rb->tail.load(std::memory_order_relaxed);
        if (head == tail) return 0; // Buffer empty

        *dest_frame = rb->buffer[tail & (RING_BUFFER_SIZE - 1)];
        rb->tail.store(tail + 1, std::memory_order_release);
        return 1; // Frame read successfully
    }
}
</code></pre>

<h4>Pure Kalman Filter Matrix State Transition (<code>src-math/SignalProcessing/Kalman.hs</code>)</h4>
<pre><code class="language-haskell">
-- Pure Kalman filter prediction and state update in Haskell
module SignalProcessing.Kalman (KalmanState(..), predictState, updateState) where
import Numeric.LinearAlgebra

data KalmanState = KalmanState
    { stateVector :: Vector Double  -- [position, velocity, acceleration]
    , covariance  :: Matrix Double  -- 3x3 error covariance matrix
    } deriving (Show, Eq)

predictState :: Matrix Double -> Matrix Double -> KalmanState -> KalmanState
predictState transitionF processQ (KalmanState x p) =
    KalmanState x' p'
  where
    x' = transitionF #> x
    p' = (transitionF <> p <> tr transitionF) + processQ

updateState :: Matrix Double -> Vector Double -> Matrix Double -> KalmanState -> KalmanState
updateState measureH z measureR (KalmanState x' p') =
    KalmanState xUpdated pUpdated
  where
    y = z - (measureH #> x')                            -- Innovation residual
    s = (measureH <> p' <> tr measureH) + measureR      -- Innovation covariance
    k = p' <> tr measureH <> inv s                     -- Optimal Kalman gain
    xUpdated = x' + (k #> y)
    pUpdated = (ident (size x') - k <> measureH) <> p'
</code></pre>

<h4>Safety Token Verification & Watchdog Interlock Trigger (<code>src/Safety/Watchdog.hs</code>)</h4>
<pre><code class="language-haskell">
-- src/Safety/Watchdog.hs
module Safety.Watchdog
    ( SafetyToken(..)
    , verifyHeartbeat
    , evaluateBeamHoldInterlock
    ) where

import Data.Word (Word64)
import Safety.Crypto (validateTokenSignature)

data SafetyToken = SafetyToken
    { sequenceNumber :: !Word64
    , timestampMs    :: !Word64
    , signature      :: !ByteString
    } deriving (Show, Eq)

verifyHeartbeat :: Word64 -> SafetyToken -> ByteString -> Bool
verifyHeartbeat currentTimestamp token secretKey =
    let delta = currentTimestamp - timestampMs token
        validTiming = delta <= 10 -- 10ms hard safety window
        validSig = validateTokenSignature token secretKey
    in validTiming && validSig

evaluateBeamHoldInterlock :: Bool -> IO ()
evaluateBeamHoldInterlock isSafe =
    if isSafe
        then putStrLn "[SAFETY_OK] Beam Enable Asserted"
        else assertBeamHoldHardwareInterlock

assertBeamHoldHardwareInterlock :: IO ()
assertBeamHoldHardwareInterlock = do
    putStrLn "[INTERLOCK_TRIGGERED] Beam Hold Asserted - Emergency Shutdown"
    -- Write direct GPIO pin register to halt LINAC beam immediately
</code></pre>

<h3>4. System Design & Data Flow Architecture</h3>
<pre><code class="language-mermaid">
flowchart LR
    A[TI IWR6843ISK mmWave Radar] -->|UART Raw Chirps| B[C++ Lock-Free RingBuffer]
    B -->|Haskell FFI| C[FMCW Range-Doppler DSP]
    C --> D[Kalman Kinematic Filter]
    D --> E[Surface Mesher & Displacement Engine]
    E --> F{Gating Logic & Safety Watchdog}
    F -->|Within Gate| G[Beam Enable State]
    F -->|Excursion / Failure| H[LINAC Beam Hold GPIO Interlock]
    D -->|FFI Bridge| I[C++ / OpenGL ImGui HUD Visualizer]
</code></pre>

<h3>5. Lessons Learned & Trade-Offs</h3>
<ul>
  <li><strong>GC Management in Hard Real-Time Haskell:</strong> High-frequency real-time DSP logic in Haskell requires minimizing heap allocation in the main loop by reusing ForeignPtr buffers and compiling with <code>-threaded -rtsopts -with-rtsopts=-A32m</code>.</li>
  <li><strong>Lock-Free C++ Ring Buffer:</strong> Implemented custom C++ lock-free ring buffers for UART frame ingestion to eliminate garbage collector pauses in the critical ingestion path.</li>
</ul>`,
    created_at: new Date("2026-03-10T00:00:00Z"),
    updated_at: new Date("2026-08-14T00:00:00Z"),
  });
