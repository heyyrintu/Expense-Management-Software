// The framer-motion feature bundle, loaded LAZILY by MotionProvider.
//
// Every screen used to ship the full framer-motion runtime (39 KB gzipped —
// the largest thing on the dashboard's critical path after React itself)
// because components imported `motion.div`, which carries every animation
// feature inline. `m.div` carries none; the features arrive through
// LazyMotion, and this module is the async chunk they arrive in. Nothing on
// the first paint waits for it: elements render at their `initial` values
// and animate once the features land, which on a warm cache is before the
// user can look.
//
// domMax rather than domAnimation because Tabs and SegmentedControl use
// `layoutId` for the sliding indicator, and layout animations live only in
// the larger bundle. Dropping to domAnimation would silently turn those
// into a hard cut.
import { domMax } from "framer-motion";

export default domMax;
