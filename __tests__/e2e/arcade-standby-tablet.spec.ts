import { describeStandbyCardFit } from "./helpers/standby-fit";

// The iPad projects run this file (#2890); the card clipped on portrait
// iPads as well as phones.
describeStandbyCardFit("tablet", /^iPad/);
