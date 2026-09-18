/** @type {import('next').NextConfig} */
const config={
  output:'export',
  trailingSlash:true,
  reactStrictMode:true,
  env:{
    // Canonical production origin used by metadata/sitemap. Set SITE_URL at deploy time.
    SITE_URL:process.env.SITE_URL||'https://infinite-pokemon.vercel.app',
  },
  // The shared game code uses NodeNext-style `.js` import specifiers for the
  // server's ESM build; teach the web bundler to resolve them to source files.
  webpack:(webpackConfig)=>{
    webpackConfig.resolve.extensionAlias={
      '.js':['.ts','.tsx','.js'],
      '.jsx':['.tsx','.jsx'],
    };
    return webpackConfig;
  },
};

export default config;
