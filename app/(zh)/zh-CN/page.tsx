import type {Metadata} from 'next';
import {zhCN} from '../../content';
import {HomePage} from '../../components/pages';
import {pageMetadata} from '../../components/meta';

export function generateMetadata():Metadata{
  return pageMetadata('zh-CN','/',zhCN.meta.home.title,zhCN.meta.home.description);
}

export default function Page(){
  return <HomePage copy={zhCN}/>;
}
