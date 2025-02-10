import { eol } from './constants';

export const helpRegexp = new RegExp(`(help|-h|--help)${eol}`, 'i');

export const versionRegexp = new RegExp(/(pointdpal version|pointd-pal version|plusplus version|-v|--version)/, 'i');

export const howMuchArePtsWorthRegexp = new RegExp(/how much (are )?(.*) point(s|.*| )?worth/, 'i');
