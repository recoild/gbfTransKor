# gsheets.py - download all sheets of a google docs spreadsheet as csv
# Moified by SideWinderk(sidewinderk@gmail.com)
# source: xflr6/gsheets.py 
# https://gist.github.com/xflr6/57508d28adec1cd3cd047032e8d81266

import contextlib, csv, os
from apiclient.discovery import build  # pip3 install google-api-python-client
skipsheets = ['README']
savepath = "./cache/"

SHEET = '1LQiu94RhA5gRlcOja0oMrtRKfql14yCvJZlpa25xvi0'

def get_credentials(scopes, secrets='credentials.json', storage='storage.json'):
     from oauth2client import file, client, tools
     store = file.Storage(os.path.expanduser(storage))
     creds = store.get()
     if creds is None or creds.invalid:
         flow = client.flow_from_clientsecrets(os.path.expanduser(secrets), scopes)
         flags = tools.argparser.parse_args([])
         creds = tools.run_flow(flow, store, flags)
     return creds

def itersheets(id):
    doc = service.spreadsheets().get(spreadsheetId=id).execute()
    title = doc['properties']['title']
    sheets = [s['properties']['title'] for s in doc['sheets']]
    params = {'spreadsheetId': id, 'ranges': sheets, 'majorDimension': 'ROWS'}
    result = service.spreadsheets().values().batchGet(**params).execute()
    for name, vr in zip(sheets, result['valueRanges']):
        if(name in skipsheets):
            continue
        yield (title, name), vr['values']

def write_csv(fd, rows, encoding='UTF-8', dialect='excel'):
    csvfile = csv.writer(fd, dialect=dialect)
    for r in rows:
        csvfile.writerow([c for c in r])

# def export_csv(docid, filename_template='%(title)s - %(sheet)s.csv'):
def export_csv(docid, filename_template='%(savepath)s%(sheet)s.csv'):
    for (doc, sheet), rows in itersheets(docid):
        # filename = filename_template % {'title': doc, 'sheet': sheet}
        filename = filename_template % {'savepath': savepath,'sheet': sheet}
        with open(filename, 'w') as fd:
            write_csv(fd, rows)
creds = get_credentials(['https://www.googleapis.com/auth/spreadsheets.readonly'])
service = build('sheets', version='v4', credentials=creds)

if(__name__ == '__main__'):
    export_csv(SHEET)