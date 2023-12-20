This is a [RainbowKit](https://rainbowkit.com) + [wagmi](https://wagmi.sh) + [Next.js](https://nextjs.org/) project bootstrapped with [`create-rainbowkit`](https://github.com/rainbow-me/rainbowkit/tree/main/packages/create-rainbowkit).

## Getting Started

First, `cp .env.sample .env.local` and update the values if needed.

Then:

1. `yarn`
2. `yarn dev`

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `pages/index.tsx`. The page auto-updates as you edit the file.

## Learn More

To learn more about this stack, take a look at the following resources:

- [RainbowKit Documentation](https://rainbowkit.com) - Learn how to customize your wallet connection flow.
- [wagmi Documentation](https://wagmi.sh) - Learn how to interact with Ethereum.
- [Next.js Documentation](https://nextjs.org/docs) - Learn how to build a Next.js application.

You can check out [the RainbowKit GitHub repository](https://github.com/rainbow-me/rainbowkit) - your feedback and contributions are welcome!

## CI/CD

1. [./github/workflows/lint.yaml]: before committing to Github, run `yarn format`. Otherwise, `prettier` would raise an exception
2. Fleek: Click this link
   ![fleek](docs/fleek.png)
3. Deployment:
   1. staging(branch `main`): <https://all-weather-protocol-staging.on.fleek.co/>
   2. prod(prod `prod`): <https://all-weather-protocol.on.fleek.co/>

## TO-DO

need a linter like this one <https://github.com/david30907d/all-weather-scaffold/actions/runs/5637981937/job/15271636819>
