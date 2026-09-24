import { Page } from './Page';

// Placeholder screens so every route renders something real from phase 1.
// Each one is replaced by its own module as its phase lands (see spec §8.3).
export const Products = () => (
  <Page
    title="What is in stock"
    blurb="Browse produce by category, price and the farm that grew it — filtered to what is available right now."
  />
);

export const Farmers = () => (
  <Page
    title="Farmers"
    blurb="Every farm selling at the market, with its weekly harvest and pickup windows."
  />
);

export const Orders = () => (
  <Page title="Your orders" blurb="Track what you have reserved and when to collect it." />
);

export const About = () => (
  <Page
    title="About MarketLink"
    blurb="We connect local farms to the people who shop their market, so a trip to the market is not a gamble."
  />
);

export const Contact = () => (
  <Page title="Contact" blurb="Questions about a farm, a market or an order? Reach the team here." />
);
