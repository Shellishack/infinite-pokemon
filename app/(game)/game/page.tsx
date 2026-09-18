import type {Metadata} from 'next';
import {en} from '../../content';
import {pageMetadata} from '../../components/meta';
import GameEntry from './game-entry';

export const dynamic='force-static';

export function generateMetadata():Metadata{
  return pageMetadata('en','/game/',en.meta.game.title,en.meta.game.description);
}

const videoGameLd={
  '@context':'https://schema.org',
  '@type':'VideoGame',
  name:'Infinite Pokémon',
  description:en.meta.game.description,
  genre:['RPG','Adventure'],
  gamePlatform:['Web browser','Windows','macOS','Linux'],
  applicationCategory:'Game',
  operatingSystem:'Any',
  offers:{'@type':'Offer',price:0,priceCurrency:'USD'},
};

export default function GamePage(){
  return (
    <main className="container">
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(videoGameLd)}}/>
      <GameEntry/>
      <noscript><p>{en.game.boundary}</p></noscript>
    </main>
  );
}
