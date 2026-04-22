'use client';

import { ActivityDataNode, GHGGraphData } from '@/lib/types';
import { DetailFuel } from './detail-fuel';
import { DetailElectricity } from './detail-electricity';
import { DetailRefrigerant } from './detail-refrigerant';
import { DetailWorkHours } from './detail-work-hours';

interface Props {
  activity: ActivityDataNode;
  graph: GHGGraphData;
}

export function DetailTab({ activity, graph }: Props) {
  switch (activity.source_type) {
    case 'fuel':
      return <DetailFuel activity={activity} />;
    case 'electricity':
      return <DetailElectricity activity={activity} graph={graph} />;
    case 'refrigerant':
      return <DetailRefrigerant activity={activity} />;
    case 'work_hours':
      return <DetailWorkHours activity={activity} />;
    default:
      return <div className="px-5 py-8 text-center text-sm text-gray-500">不支援的來源類型</div>;
  }
}
