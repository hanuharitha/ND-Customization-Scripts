
/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/log', 'N/search', 'N/record', 'N/format'], function (log, search, record, format) {



    function afterSubmit(context) {

        try {
            var newRec = context.newRecord;
            var invoiceId = newRec.id;
            var invoiceRec = record.load({type: record.Type.INVOICE,id: invoiceId,isDynamic: false});
            var lineCount = invoiceRec.getLineCount({ sublistId: 'item' });
            var chargeMap = {};
            var billingScheduleId;
            var repeatEvery;
            var scheduleName;
            var chargeSearch = search.create({
                type: 'charge',
                filters: [
                    ["invoice.internalid", "anyof", invoiceId]
                ],
                columns: [
                    'subscriptionline',
                    'servicestartdate',
                    'serviceenddate',
                    'billingschedule'
                ]
            });

            chargeSearch.run().each(function (result) {
                var subscriptionLineId = result.getValue('subscriptionline');

                if (subscriptionLineId) {
                    chargeMap[subscriptionLineId] = {
                        startDate: result.getValue('servicestartdate'),
                        endDate: result.getValue('serviceenddate'),
                    };
                    billingScheduleId = result.getValue('billingschedule');
                }
                return true;
            });
            log.debug('Charge Map', chargeMap);
            log.debug("billingschedule Id", billingScheduleId);

            if (billingScheduleId) {
               
                var billingScheduleSearch = search.create({
                    type: 'billingschedule',
                    filters: [
                        ['name', 'is', billingScheduleId]
                    ],
                    columns: [
                        'name',
                        'repeatevery'
                    ]
                });

                billingScheduleSearch.run().each(function (result) {
                    scheduleName = result.getValue({ name: 'name'});
                    repeatEvery = result.getValue({name: 'repeatevery'});
                    return false; 
                });
            }
            log.debug("repeatEvery", repeatEvery);
            log.debug("scheduleName", scheduleName);

            for (var i = 0; i < lineCount; i++) {
                var subLineId = invoiceRec.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'subscriptionline',
                    line: i
                });
                log.debug("subLineId", subLineId);

                invoiceRec.setSublistValue({ sublistId: 'item', fieldId: 'custcol_serviceperiodstartdate', line: i, value: new Date(chargeMap[subLineId].startDate) });
                invoiceRec.setSublistValue({ sublistId: 'item', fieldId: 'custcol_serviceperiod_enddate', line: i, value: new Date(chargeMap[subLineId].endDate) });
                invoiceRec.setSublistValue({ sublistId: 'item', fieldId: 'custcol_billingfrequency', line: i, value: scheduleName });
                var lineAmount = invoiceRec.getSublistValue({ sublistId: 'item', fieldId: 'amount', line: i });
                var adjustedAmount = lineAmount;
                if (billingScheduleId) {
                    adjustedAmount = lineAmount / repeatEvery;
                }
                log.debug()
                invoiceRec.setSublistValue({ sublistId: 'item', fieldId: 'custcol_price_per_month', line: i, value: adjustedAmount });
                invoiceRec.setSublistValue({ sublistId: 'item', fieldId: 'custcol_number_of_months', line: i, value: repeatEvery });
                
            }
            invoiceRec.save({
                enableSourcing: false,
                ignoreMandatoryFields: true
            });

        } catch (e) {
            log.error({
                title: 'Error in afterSubmit',
                details: e
            });
        }
    }





    return {

        afterSubmit: afterSubmit
    };
});



