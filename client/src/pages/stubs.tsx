import { Page } from './Page';

// Placeholder screens so every route renders something real from phase 1.
// Each one is replaced by its own module as its phase lands (see spec §8.3).
export const Home = () => (
  <Page
    title="Fresh from the market."
    accent="Before you get there."
    blurb="See what local farmers are growing this week, check what is actually in stock, and reserve it for pickup."
  />
);

export const Markets = () => (
  <Page
    title="Markets near you"
    blurb="Find farmers markets by location and day, and see which stalls will be there."
  />
);

export const Products = () => (
  <Page
    title="What is in stock"
    blurb="Browse produce by category, price and market — filtered to what is available right now."
  />
);

export const Farmers = () => (
  <Page
    title="Farmers"
    blurb="Every stall at the market, with their weekly harvest and pickup windows."
  />
);

export const Orders = () => (
  <Page title="Your orders" blurb="Track what you have reserved and when to collect it." />
);

export const About = () => (
  <Page
    title="About MarketLink"
    blurb="We connect farmers-market stalls with the people who shop them, so a trip to the market is not a gamble."
  />
);

export const Contact = () => (
  <Page title="Contact" blurb="Questions about a stall, a market or an order? Reach the team here." />
);
