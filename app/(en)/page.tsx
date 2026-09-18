import type {Metadata} from 'next';
import {en} from '../content';
import {HomePage} from '../components/pages';
import {pageMetadata} from '../components/meta';

export function generateMetadata():Metadata{
  return pageMetadata('en','/',en.meta.home.title,en.meta.home.description);
}

export default function Page(){
  return <HomePage copy={en}/>;
}
