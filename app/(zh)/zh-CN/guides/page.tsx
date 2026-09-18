import type {Metadata} from 'next';
import {zhCN} from '../../../content';
import {GuidesIndexPage} from '../../../components/pages';
import {pageMetadata} from '../../../components/meta';

export function generateMetadata():Metadata{
  return pageMetadata('zh-CN','/guides/',zhCN.meta.guides.title,zhCN.meta.guides.description);
}

export default function Page(){
  return <GuidesIndexPage copy={zhCN}/>;
}
